// api/verify-payment.js
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Handle both GET (from callback) and POST (from frontend)
        let reference;
        let bundleInfo = null;

        if (req.method === 'GET') {
            reference = req.query.reference;
            // Get bundle info from query params if available
            bundleInfo = {
                title: req.query.bundle,
                phone: req.query.phone,
                amountZAR: req.query.amount,
                amountUSD: req.query.usd
            };
        } else if (req.method === 'POST') {
            reference = req.body.reference;
            bundleInfo = req.body.bundleInfo;
        } else {
            return res.status(405).json({ 
                success: false, 
                error: 'Method not allowed' 
            });
        }

        if (!reference) {
            return res.status(400).json({
                success: false,
                error: 'Reference is required'
            });
        }

        // 🔐 SECRET KEY - Set this in your environment variables
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

        if (!paystackSecretKey) {
            console.error('PAYSTACK_SECRET_KEY is not set');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error'
            });
        }

        // Verify transaction with Paystack using SECRET KEY
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paystack verification error:', data);
            return res.status(response.status).json({
                success: false,
                error: data.message || 'Verification failed'
            });
        }

        // Check if payment was successful
        if (data.data && data.data.status === 'success') {
            // ✅ Payment is confirmed!
            
            // Get metadata from the transaction
            const metadata = data.data.metadata || {};
            
            const paymentDetails = {
                reference: data.data.reference,
                amount: data.data.amount / 100,
                currency: data.data.currency,
                paid_at: data.data.paid_at,
                bundle_name: metadata.bundle_name || (bundleInfo ? bundleInfo.title : 'Unknown'),
                recipient_phone: metadata.recipient_phone || (bundleInfo ? bundleInfo.phone : 'Unknown'),
                amount_zar: metadata.amount_zar || (bundleInfo ? bundleInfo.amountZAR : 'Unknown'),
                amount_usd: metadata.amount_usd || (bundleInfo ? bundleInfo.amountUSD : data.data.amount / 100),
                customer_email: metadata.customer_email || data.data.customer.email
            };
            
            console.log('Payment verified:', paymentDetails);
            
            // Here you would trigger data bundle delivery
            // await deliverDataBundle(paymentDetails.recipient_phone, paymentDetails.bundle_name);
            
            return res.status(200).json({
                success: true,
                message: 'Payment verified successfully',
                data: paymentDetails
            });
        } else {
            return res.status(200).json({
                success: false,
                error: 'Payment not successful',
                status: data.data ? data.data.status : 'unknown'
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