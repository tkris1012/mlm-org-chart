// === Stripe 決済 Webhook (Cloud Functions gen2 / Functions Framework) =====
// Stripe の Payment Link で支払いが完了すると、このエンドポイントに通知が届く。
// 署名を検証したうえで Firestore の users/{uid}.plan を書き換える。
// クライアントは onSnapshot で即座にプランが反映される。
//
// 大量課金対策:
//   - --max-instances=3      … デプロイ時に指定（攻撃で大量リクエストが来ても頭打ち）
//   - 署名検証 (constructEvent) … Stripe 以外からの偽リクエストを即拒否
//   - POST 以外は 405 で早期リターン
//
// 環境変数 (デプロイ時に注入):
//   STRIPE_SECRET_KEY      … Secret Manager から (--set-secrets)
//   STRIPE_WEBHOOK_SECRET  … Secret Manager から (--set-secrets)
//   STRIPE_PRICE_LIGHT     … 通常の環境変数から (--set-env-vars)
//   STRIPE_PRICE_PRO       … 通常の環境変数から (--set-env-vars)

const functions = require('@google-cloud/functions-framework')
const admin = require('firebase-admin')
const Stripe = require('stripe')

admin.initializeApp()
const db = admin.firestore()

// 購入された price ID からプラン名を判定する
function planForPrice(priceId) {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_LIGHT) return 'light'
  return null
}

functions.http('stripeWebhook', async (req, res) => {
  // POST 以外は処理せず即拒否
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const sig = req.headers['stripe-signature']

  // 署名検証: Stripe 以外からの偽リクエストはここで弾く
  let event
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    console.warn('Webhook 署名検証に失敗:', err.message)
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event.data.object)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionEnded(event.data.object)
        break
      default:
        break // 関心の無いイベントは 200 を返して再送を止める
    }
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook 処理中にエラー:', err)
    res.status(500).send('Internal error')
  }
})

// 支払い完了 → プランを付与
async function handleCheckoutCompleted(stripe, session) {
  const uid = session.client_reference_id
  if (!uid) {
    console.warn('client_reference_id の無いセッション:', session.id)
    return
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 1,
  })
  const priceId = lineItems.data[0]?.price?.id
  const plan = planForPrice(priceId)
  if (!plan) {
    console.warn('未知の price のため無視:', priceId)
    return
  }

  await db.collection('users').doc(uid).set(
    {
      plan,
      stripeCustomerId: session.customer || null,
      stripeSubscriptionId: session.subscription || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  console.log(`プラン更新: ${uid} → ${plan}`)
}

// サブスク終了 (解約・支払い失敗による失効) → 無料に戻す
async function handleSubscriptionEnded(subscription) {
  const snap = await db
    .collection('users')
    .where('stripeSubscriptionId', '==', subscription.id)
    .limit(1)
    .get()
  if (snap.empty) {
    console.warn('該当ユーザーが見つからないサブスク:', subscription.id)
    return
  }
  await snap.docs[0].ref.set(
    { plan: 'free', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  )
  console.log(`プラン解約: ${snap.docs[0].id} → free`)
}
