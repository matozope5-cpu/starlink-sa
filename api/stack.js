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
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

        if (!paystackSecretKey) {
            console.error('PAYSTACK_SECRET_KEY is not set');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error'
            });
        }

        // Generate a truly unique reference
        // Format: STARLINK-{timestamp}-{random}-{email-hash}
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        const emailHash = Buffer.from(email).toString('base64').substring(0, 5).replace(/[^a-zA-Z0-9]/g, '');
        const reference = `STARLINK-${timestamp}-${random}-${emailHash}`;

        // Your website URL where users will return after payment
        const baseUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000' 
            : 'https://starlink-sa.vercel.app'; // Change to your production URL

        // Clean the bundle title for URL
        const cleanBundleTitle = encodeURIComponent(bundleTitle);
        const cleanPhone = encodeURIComponent(recipientPhone);

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
                callback_url: `${baseUrl}/?reference=${reference}`,
                metadata: {
                    bundle_name: bundleTitle,
                    recipient_phone: recipientPhone,
                    amount_zar: amountZAR,
                    amount_usd: amountUSD,
                    customer_name: customerName,
                    customer_email: email,
                    timestamp: timestamp
                }
            })
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            // Check if error is due to duplicate reference
            if (data.message && data.message.includes('duplicate')) {
                // Retry with a new reference
                return handler(req, res);
            }
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