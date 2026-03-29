-- ============================================================================
-- INSTITUTION BRANDING UPDATE - GRADIENTS & COLORS
-- ============================================================================
-- Update institution branding with gradient colors for headers
-- NIC International College (ID 4): Blue gradient
-- The Socialist Republic (ID 5): Red gradient with black/white/red theme
-- ============================================================================

-- Update NIC International College (ID 4) with blue gradient
UPDATE institutions 
SET 
  primary_color = '#1e3a8a',      -- Deep blue
  secondary_color = '#1e40af',    -- Slightly lighter blue for gradient
  logo_url = '/logos/nic-logo.png',
  favicon_url = '/logos/nic-favicon.ico',
  welcome_text = 'NIC International College'
WHERE id = 4;

-- Update or Insert The Socialist Republic (ID 5) with red gradient
INSERT INTO institutions (
  id,
  name,
  subdomain,
  timezone,
  primary_color,
  secondary_color,
  logo_url,
  favicon_url,
  welcome_text,
  has_grammar_world,
  has_ielts_speaking,
  subscription_tier,
  subscription_status,
  allow_b2c_payments
) VALUES (
  5,
  'The Socialist Republic',
  'socialist-republic',
  'UTC',
  '#dc2626',              -- Red (primary)
  '#991b1b',              -- Darker red for gradient (secondary)
  '/logos/ej-logo.png',
  '/logos/ej-logo.png',
  'The Socialist Republic',
  true,
  true,
  'premium',
  'active',
  false
)
ON CONFLICT (id) 
DO UPDATE SET
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  logo_url = EXCLUDED.logo_url,
  favicon_url = EXCLUDED.favicon_url,
  welcome_text = EXCLUDED.welcome_text,
  has_grammar_world = EXCLUDED.has_grammar_world,
  has_ielts_speaking = EXCLUDED.has_ielts_speaking,
  subscription_tier = EXCLUDED.subscription_tier,
  subscription_status = EXCLUDED.subscription_status,
  allow_b2c_payments = EXCLUDED.allow_b2c_payments;

-- Update Hayford Academy (ID 1) to have matching gradient colors
UPDATE institutions 
SET 
  primary_color = '#800000',      -- Maroon
  secondary_color = '#600000'     -- Darker maroon for gradient
WHERE id = 1;

-- Verify the updates
SELECT id, name, primary_color, secondary_color, logo_url, welcome_text 
FROM institutions 
WHERE id IN (1, 4, 5)
ORDER BY id;
