const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// @route   POST /api/stripe/create-checkout-session
// @desc    Create a Stripe Checkout Session for premium upgrade
// @access  Private (requires JWT)
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const user = req.user;

    // Always fetch fresh institution data — JWT may pre-date allow_b2c_payments being set
    let allow_b2c_payments = user.allow_b2c_payments || false;
    let current_subscription_tier = user.subscription_tier || 'free';

    if (user.institution_id) {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query(
          'SELECT allow_b2c_payments, subscription_tier FROM institutions WHERE id = $1',
          [user.institution_id]
        );
        if (rows.length > 0) {
          allow_b2c_payments = rows[0].allow_b2c_payments || false;
        }
        // Also get fresh user tier
        const [userRows] = await conn.query(
          'SELECT subscription_tier FROM users WHERE id = $1',
          [user.id]
        );
        if (userRows.length > 0 && userRows[0].subscription_tier) {
          current_subscription_tier = userRows[0].subscription_tier;
        }
      } finally {
        conn.release();
      }
    }

    // Verify user has B2C payments enabled for their institution
    if (!allow_b2c_payments) {
      return res.status(403).json({ 
        error: 'B2C payments are not enabled for your institution. Please contact your administrator for enterprise billing.' 
      });
    }

    // Verify user is on free tier
    if (current_subscription_tier !== 'free') {
      return res.status(400).json({ 
        error: 'You already have an active subscription.' 
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Hayford Hub Premium',
              description: 'Unlock unlimited access to all features including IELTS Writing, Speaking, Grammar World, and Vocab Builder',
              images: ['https://hub.hayfordacademy.com/logo.png'],
            },
            unit_amount: 999, // $9.99 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: user.institution_id.toString(), // Critical for webhook fulfillment
      metadata: {
        user_id: user.id.toString(),
        institution_id: user.institution_id.toString(),
        user_email: user.email,
      },
      success_url: `${FRONTEND_URL}/dashboard?payment=success`,
      cancel_url: `${FRONTEND_URL}/dashboard?payment=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    console.log(`✅ Stripe checkout session created for user ${user.email}: ${session.id}`);

    res.json({ 
      url: session.url,
      sessionId: session.id 
    });

  } catch (err) {
    console.error('❌ Error creating Stripe checkout session:', err);
    res.status(500).json({ 
      error: 'Failed to create checkout session. Please try again later.' 
    });
  }
});

// @route   GET /api/stripe/portal
// @desc    Create a Stripe Customer Portal session for managing subscription
// @access  Private (requires JWT)
router.post('/create-portal-session', auth, async (req, res) => {
  try {
    const user = req.user;

    // Verify user has a Stripe customer ID
    if (!user.stripe_customer_id) {
      return res.status(400).json({ 
        error: 'No active subscription found.' 
      });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${FRONTEND_URL}/dashboard`,
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error('❌ Error creating portal session:', err);
    res.status(500).json({ 
      error: 'Failed to create portal session. Please try again later.' 
    });
  }
});

// @route   POST /api/stripe/webhook
// @desc    Stripe webhook endpoint for payment events
// @access  Public (verified by Stripe signature)
// NOTE: This route MUST use raw body parser, configured in server.js
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify the event came from Stripe using the signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        console.log('✅ Checkout session completed:', session.id);
        console.log('   Customer:', session.customer);
        console.log('   Metadata:', session.metadata);

        // Extract user_id from metadata (set during checkout session creation)
        const userId = session.metadata?.user_id;
        const stripeCustomerId = session.customer;

        if (!userId) {
          console.error('❌ No user_id in session metadata');
          return res.status(400).json({ error: 'Missing user_id in metadata' });
        }

        const connection = await pool.getConnection();

        try {
          // Update user's subscription tier and save Stripe customer ID
          const [result] = await connection.query(
            'UPDATE users SET subscription_tier = $1, stripe_customer_id = $2 WHERE id = $3',
            ['premium', stripeCustomerId, userId]
          );

          console.log(`✅ User ${userId} upgraded to premium (Stripe Customer: ${stripeCustomerId})`);

          // Verify the update
          const [users] = await connection.query(
            'SELECT id, email, first_name, last_name, subscription_tier, stripe_customer_id FROM users WHERE id = $1',
            [userId]
          );

          if (users.length > 0) {
            const user = users[0];
            console.log(`✅ Verified: ${user.first_name} ${user.last_name} (${user.email}) is now ${user.subscription_tier}`);
          }

          connection.release();
        } catch (dbError) {
          console.error('❌ Database error during webhook processing:', dbError);
          if (connection) connection.release();
          throw dbError;
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;

        console.log('⚠️  Subscription cancelled for customer:', stripeCustomerId);

        const connection = await pool.getConnection();

        try {
          // Downgrade user back to free tier
          await connection.query(
            'UPDATE users SET subscription_tier = $1 WHERE stripe_customer_id = $2',
            ['free', stripeCustomerId]
          );

          console.log(`✅ User with Stripe customer ${stripeCustomerId} downgraded to free`);
          connection.release();
        } catch (dbError) {
          console.error('❌ Database error during subscription cancellation:', dbError);
          if (connection) connection.release();
          throw dbError;
        }

        break;
      }

      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });

  } catch (err) {
    console.error('❌ Error processing webhook event:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
