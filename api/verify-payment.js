// api/verify-payment.js
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
        const { reference, bundle, recipientPhone } = req.body;

        if (!reference) {
            return res.status(400).json({
                success: false,
                error: 'Reference is required'
            });
        }

        // 🔐 SECRET KEY - NEVER expose this to frontend
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY; // Set this in your environment variables

        // Verify transaction with Paystack using SECRET KEY
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
            // ✅ Payment is confirmed!
            
            // Here you would:
            // 1. Save transaction to your database
            // 2. Trigger data bundle delivery (call your telecom provider's API)
            // 3. Send confirmation SMS/email to customer
            
            console.log('Payment verified:', {
                reference: data.data.reference,
                amount: data.data.amount / 100, // Convert from cents
                currency: data.data.currency,
                bundle: bundle,
                phone: recipientPhone
            });
            
            return res.status(200).json({
                success: true,
                message: 'Payment verified successfully',
                data: {
                    reference: data.data.reference,
                    amount: data.data.amount / 100,
                    currency: data.data.currency,
                    paid_at: data.data.paid_at
                }
            });
        } else {
            return res.status(200).json({
                success: false,
                error: 'Payment not successful',
                status: data.data.status
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