// api/stack.js
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }

    try {
        const { 
            email, 
            amountUSD, 
            bundleTitle, 
            recipientPhone, 
            amountZAR,
            customerName = 'Starlink Customer' 
        } = req.body;

        // Validate required fields
        if (!email || !amountUSD || !bundleTitle || !recipientPhone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Paystack secret key (store in environment variables)
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_live_your_secret_key_here';

        // Generate unique reference
        const reference = 'STARLINK-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

        // Initialize transaction with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                amount: amountUSD * 100, // Convert to cents
                currency: 'USD',
                reference: reference,
                metadata: {
                    bundle_name: bundleTitle,
                    recipient_phone: recipientPhone,
                    amount_zar: amountZAR,
                    customer_name: customerName,
                    custom_fields: [
                        {
                            display_name: "Bundle",
                            variable_name: "bundle",
                            value: bundleTitle
                        },
                        {
                            display_name: "Recipient Phone",
                            variable_name: "recipient_phone",
                            value: recipientPhone
                        },
                        {
                            display_name: "Amount (ZAR)",
                            variable_name: "amount_zar",
                            value: amountZAR.toString()
                        }
                    ]
                },
                callback_url: 'https://yourdomain.com/payment-callback', // Optional: where to redirect after payment
                channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'] // Available payment methods
            })
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.message || 'Failed to initialize payment');
        }

        // Return the authorization URL and reference to frontend
        return res.status(200).json({
            success: true,
            authorization_url: data.data.authorization_url,
            reference: data.data.reference,
            access_code: data.data.access_code
        });

    } catch (error) {
        console.error('Paystack initialization error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}