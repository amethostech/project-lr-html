import User from '../models/User.js';

 const getProfile = async (req, res) => {
   try {
        // **CRITICAL CHANGE: Get the email from the new property**
        const userEmail = req.userEmail; 

        if (!userEmail) {
            // Should not happen if middleware works, but good for safety
             return res.status(401).json({ message: 'Authentication required' });
        }

        // 2. Fetch the user from the database **using email**
        const userProfile = await User.findOne({ email: userEmail }).select('-password'); 

        // 3. Check if the user exists
        if (!userProfile) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // You now have the full user object including the ID!
        // If you need the ID, it's userProfile._id.

        // 4. Send the profile details back
        res.status(200).json({
            success: true,
            data: userProfile
        });

    } catch (error) {
        console.error('Profile retrieval error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export {getProfile};