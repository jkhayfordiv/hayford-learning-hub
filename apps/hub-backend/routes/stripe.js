const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const auth = require('../middleware/auth');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// @route   POST /api/stripe/create-checkout-session
// @desc    Create a Stripe Checkout Session for premium upgrade
// @access  Private (requires JWT)
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const user = req.user;

    // Verify user has B2C payments enabled for their institution
    if (!user.allow_b2c_payments) {
      return res.status(403).json({ 
        error: 'B2C payments are not enabled for your institution. Please contact your administrator for enterprise billing.' 
      });
    }

    // Verify user is on free tier
    if (user.subscription_tier !== 'free') {
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

module.exports = router;
