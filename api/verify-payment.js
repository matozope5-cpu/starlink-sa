// api/verify-payment.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }

    try {
        const { reference } = req.query;

        if (!reference) {
            return res.status(400).json({
                success: false,
                error: 'Reference is required'
            });
        }

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_live_your_secret_key_here';

        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.message || 'Verification failed');
        }

        // Check if payment was successful
        if (data.data.status === 'success') {
            // Here you would typically:
            // 1. Update your database
            // 2. Trigger data bundle delivery
            // 3. Send confirmation SMS/email
            
            return res.status(200).json({
                success: true,
                status: 'success',
                data: {
                    reference: data.data.reference,
                    amount: data.data.amount,
                    currency: data.data.currency,
                    paid_at: data.data.paid_at,
                    metadata: data.data.metadata
                }
            });
        } else {
            return res.status(200).json({
                success: false,
                status: data.data.status,
                message: 'Payment not successful'
            });
        }

    } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}