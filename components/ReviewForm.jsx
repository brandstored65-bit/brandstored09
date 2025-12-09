'use client'
import { useState, useEffect } from "react"

import { StarIcon } from "lucide-react"
import Image from "next/image"
import axios from "axios"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"

import { auth } from '../lib/firebase';
export default function ReviewForm({ productId, onReviewAdded }) {
    const [user, setUser] = useState(null);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [getToken, setGetToken] = useState(() => async () => null);
    const router = useRouter();
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setIsSignedIn(!!firebaseUser);
            setGetToken(() => async () => firebaseUser ? firebaseUser.getIdToken() : null);
        });
        return () => unsubscribe();
    }, []);

    const [showForm, setShowForm] = useState(false)
    const [rating, setRating] = useState(5)
    const [review, setReview] = useState('')
    const [images, setImages] = useState([])
    const [imagePreviews, setImagePreviews] = useState([])
    const [submitting, setSubmitting] = useState(false)

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files)
        setImages(files)
        
        // Create previews
        const previews = files.map(file => URL.createObjectURL(file))
        setImagePreviews(previews)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (!isSignedIn) {
            toast.error('Please sign in to write a review')
            router.push('/sign-in')
            return
        }

        if (!review.trim()) {
            toast.error('Please write a review')
            return
        }
        // Email is optional, do not validate

        try {
            setSubmitting(true)
            const formData = new FormData()
            formData.append('productId', productId)
            formData.append('rating', rating)
            formData.append('review', review)
            // If you have an email field, only append if present
            // if (email) formData.append('email', email)
            
            images.forEach(img => {
                formData.append('images', img)
            })

            const token = await getToken()
            const { data } = await axios.post('/api/review', formData, {
                headers: { Authorization: `Bearer ${token}` }
            })

            toast.success('Review submitted! Pending approval by store.')
            setShowForm(false)
            setRating(5)
            setReview('')
            setImages([])
            setImagePreviews([])
            
            if (onReviewAdded) {
                onReviewAdded(data.review)
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to submit review')
        } finally {
            setSubmitting(false)
        }
    }

    if (!showForm) {
        if (!isSignedIn) return null;
        return (
            <div className="flex items-center justify-center gap-2">
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => {
                                setRating(star)
                                setShowForm(true)
                            }}
                            className="transition hover:scale-110"
                        >
                            <StarIcon
                                size={32}
                                fill="#D1D5DB"
                                className="text-transparent cursor-pointer hover:fill-yellow-400"
                            />
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="border-t border-gray-200 pt-4 mt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Rating */}
                <div>
                    <label className="block text-sm font-medium mb-2">Your Rating *</label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className="transition hover:scale-110"
                            >
                                <StarIcon
                                    size={32}
                                    fill={rating >= star ? "#FFA500" : "#D1D5DB"}
                                    className="text-transparent cursor-pointer"
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Review Text */}
                <div>
                    <label className="block text-sm font-medium mb-2">Your Review *</label>
                    <textarea
                        required
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        rows={5}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Share your thoughts about this product..."
                    />
                </div>

                {/* Image Upload */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Add Photos (Optional)
                    </label>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        You can upload multiple photos to showcase your experience
                    </p>
                    
                    {/* Image Previews */}
                    {imagePreviews.length > 0 && (
                        <div className="flex gap-3 mt-3 flex-wrap">
                            {imagePreviews.map((preview, idx) => (
                                <div key={idx} className="relative">
                                    <Image
                                        src={preview}
                                        alt={`Preview ${idx + 1}`}
                                        width={100}
                                        height={100}
                                        className="rounded-lg object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImages(images.filter((_, i) => i !== idx))
                                            setImagePreviews(imagePreviews.filter((_, i) => i !== idx))
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition disabled:bg-gray-400"
                    >
                        {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowForm(false)
                            setRating(5)
                            setReview('')
                            setImages([])
                            setImagePreviews([])
                        }}
                        className="px-6 py-2.5 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}
