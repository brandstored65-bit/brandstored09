import React, { useState } from 'react';
import { X } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import Image from 'next/image';
import GoogleIcon from '../assets/google.png';
import axios from 'axios';

const SignInModal = ({ open, onClose }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Optionally send welcome email, etc.
      onClose();
    } catch (err) {
      setError('Google sign-in failed');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRegister) {
      if (!validateEmail(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    setLoading(true);
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        // Optionally send welcome email, etc.
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-xl shadow-lg p-6 relative animate-slideUp sm:animate-fadeIn rounded-t-3xl sm:rounded-t-xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideUp 0.3s ease-out',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <button
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={22} />
        </button>
        <h2 className="text-xl sm:text-2xl font-bold mb-1 text-center">{isRegister ? 'Register' : 'Log in for the best experience'}</h2>
        <p className="text-sm text-gray-500 text-center mb-4">
          Enter your email to continue
        </p>
        <form className="flex flex-col gap-3 mb-2" onSubmit={handleSubmit}>
          {isRegister && (
            <input
              type="text"
              placeholder="Full Name"
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {isRegister && (
            <input
              type="password"
              placeholder="Confirm Password"
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          )}
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg transition text-base"
            disabled={loading}
          >
            {isRegister ? 'Register' : 'Continue'}
          </button>
        </form>
        {error && <div className="text-red-500 text-xs text-center mb-2">{error}</div>}
        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 px-4 text-sm font-medium bg-white hover:bg-gray-50 transition shadow-sm mb-4"
          disabled={loading}
        >
          <Image src={GoogleIcon} alt="Google" width={20} height={20} style={{objectFit:'contain'}} />
          <span className="text-gray-700">Continue with Google</span>
        </button>
        <div className="text-center">
          <button
            className="text-sm text-blue-600 hover:underline font-medium"
            onClick={() => setIsRegister(v => !v)}
            type="button"
          >
            {isRegister ? 'Already have an account? Sign in' : "New user? Create an account"}
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          By continuing, you agree to our <a href="/terms" className="underline">Terms of Use</a> and <a href="/privacy-policy" className="underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default SignInModal;