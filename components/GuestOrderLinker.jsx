'use client'


import { useEffect, useState } from 'react'
import axios from 'axios'
import { getAuth } from "firebase/auth";
import toast from 'react-hot-toast'
// TODO: Import your Firebase Auth hooks/utilities here


export default function GuestOrderLinker() {
    // TODO: Replace with your Firebase Auth state
    // Example: const user = firebase.auth().currentUser;
    // Example: const isSignedIn = !!user;
    // Example: const getToken = async () => user && user.getIdToken();
    const [checked, setChecked] = useState(false)
    // Placeholder logic for Firebase Auth
    const user = getAuth().currentUser;
    const isSignedIn = !!user;
    const getToken = async () => {
        return user ? await user.getIdToken() : null;
    }


    useEffect(() => {
        const linkGuestOrders = async () => {
            if (!isSignedIn || !user || checked) return

            try {
                const token = await getToken()
                // TODO: Update these fields to match your Firebase user object
                const email = user?.email
                const phone = user?.phoneNumber

                if (!email && !phone) return

                const { data } = await axios.post('/api/user/link-guest-orders', {
                    email,
                    phone
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                })

                if (data.linked && data.count > 0) {
                    toast.success(`Welcome back! We've linked ${data.count} previous order(s) to your account.`, {
                        duration: 5000
                    })
                }

                setChecked(true)
            } catch (error) {
                // Silently fail - this is a background operation
                console.error('Failed to link guest orders:', error)
                setChecked(true)
            }
        }

        // Run after a short delay to avoid blocking initial page load
        const timer = setTimeout(linkGuestOrders, 2000)
        return () => clearTimeout(timer)
    }, [isSignedIn, user, getToken, checked])

    return null // This component doesn't render anything
}
