import React, { useState, useEffect } from 'react';
import { X, Truck, Undo2 } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import Image from 'next/image';
import GoogleIcon from '../assets/google.png';
import axios from 'axios';

const SignInModal = ({ open, onClose }) => {
  const [isRegister, setIsRegister] = useState(false);
  // Country code state for phone auth
  const [selectedCountryCode, setSelectedCountryCode] = useState('+91');
  const [usePhone, setUsePhone] = useState(true); // Default to phone login
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Listen for custom event from TopBarNotification
  useEffect(() => {
    const handleOpenModal = (event) => {
      if (event.detail) {
        setIsRegister(event.detail.isRegister || false);
      }
    };

    window.addEventListener('openSignInModal', handleOpenModal);
    return () => window.removeEventListener('openSignInModal', handleOpenModal);
  }, []);

  // Setup RecaptchaVerifier
  useEffect(() => {
    if (open && usePhone && !window.recaptchaVerifier) {
      // Wait for the container to exist in the DOM
      const interval = setInterval(() => {
        const container = document.getElementById('recaptcha-container');
        if (container) {
          try {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
              callback: () => {
                // reCAPTCHA solved
              },
              'sitekey': '6LeCICEsAAAAAN4KV7qmPiVhzRtYKPx4_J4-zwEe' // Updated site key
            });
          } catch (error) {
            console.error('RecaptchaVerifier error:', error);
          }
          clearInterval(interval);
        }
      }, 100);
      // Safety: clear interval after 2 seconds
      setTimeout(() => clearInterval(interval), 2000);
    }
  }, [open, usePhone]);

  if (!open) return null;

  const validateEmail = (email) => {
    // Simple email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendOTP = async () => {
    setError('');
    // Assume you have a state for selectedCountryCode, e.g. '+91'
    // If not, default to '+91'
    const countryCode = selectedCountryCode || '+91';
    const number = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    const formattedPhone = `${countryCode}${number}`;
    if (!/^\+\d{10,}$/.test(formattedPhone)) {
      setError('Please enter a valid phone number. Example: 7592875212');
      return;
    }
    setLoading(true);
    try {
      // Recreate recaptcha if needed
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'sitekey': '6LeCICEsAAAAAN4KV7qmPiVhzRtYKPx4_J4-zwEe' // Updated site key
        });
      }
      
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      
      // Store confirmation result for later verification
      window.confirmationResult = confirmationResult;
      setOtpSent(true);
      setError('');
    } catch (err) {
      console.error('OTP send error:', err);
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      // Handle specific Firebase errors
      if (err.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please upgrade your Firebase plan or try email login.';
      } else if (err.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number. Please check and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      // Reset recaptcha
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
        window.recaptchaVerifier = null;
      }
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    setError('');
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      // Use the stored confirmation result
      if (!window.confirmationResult) {
        setError('Please request OTP again');
        setOtpSent(false);
        setLoading(false);
        return;
      }
      
      await window.confirmationResult.confirm(otp);
      
      // Check if welcome bonus was claimed
      const bonusClaimed = localStorage.getItem('welcomeBonusClaimed');
      if (bonusClaimed === 'true') {
        localStorage.setItem('freeShippingEligible', 'true');
        localStorage.removeItem('welcomeBonusClaimed');
      }
      
      // Clear stored data
      window.confirmationResult = null;
      
      onClose();
    } catch (err) {
      console.error('OTP verification error:', err);
      setError('Invalid OTP. Please try again.');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Check if welcome bonus was claimed from top bar
      const bonusClaimed = localStorage.getItem('welcomeBonusClaimed');
      if (bonusClaimed === 'true') {
        // Mark user as eligible for free shipping on first order
        localStorage.setItem('freeShippingEligible', 'true');
        localStorage.removeItem('welcomeBonusClaimed');
      }
      
      // Send welcome email for new users
      try {
        const token = await result.user.getIdToken();
        await axios.post('/api/send-welcome-email', {
          email: result.user.email,
          name: result.user.displayName
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the signup if email fails
      }
      
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
        
        // Check if welcome bonus was claimed from top bar
        const bonusClaimed = localStorage.getItem('welcomeBonusClaimed');
        if (bonusClaimed === 'true') {
          // Mark user as eligible for free shipping on first order
          localStorage.setItem('freeShippingEligible', 'true');
          localStorage.removeItem('welcomeBonusClaimed');
        }
        
        // Send welcome email for new registrations
        try {
          const token = await userCredential.user.getIdToken();
          await axios.post('/api/send-welcome-email', {
            email: email,
            name: name
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the signup if email fails
        }
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
          {usePhone ? 'Enter your phone number to continue' : 'Enter your email to continue'}
        </p>
        
        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setUsePhone(true); setOtpSent(false); setError(''); }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
              usePhone ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Phone
          </button>
          <button
            type="button"
            onClick={() => { setUsePhone(false); setOtpSent(false); setError(''); }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
              !usePhone ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Email
          </button>
        </div>

        {usePhone ? (
          // Phone Authentication
          <div className="flex flex-col gap-3 mb-2">
            {!otpSent ? (
              <>
                <div className="flex gap-2">
                  <select 
                    className="border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                    value={phoneNumber.split(' ')[0] || '+91'}
                    onChange={(e) => {
                      const code = e.target.value;
                      const number = phoneNumber.split(' ')[1] || '';
                      setPhoneNumber(`${code} ${number}`);
                    }}
                  >
                    <option value="+93">🇦🇫 +93</option>
                    <option value="+355">🇦🇱 +355</option>
                    <option value="+213">🇩🇿 +213</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+376">🇦🇩 +376</option>
                    <option value="+244">🇦🇴 +244</option>
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+374">🇦🇲 +374</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+43">🇦🇹 +43</option>
                    <option value="+994">🇦🇿 +994</option>
                    <option value="+973">🇧🇭 +973</option>
                    <option value="+880">🇧🇩 +880</option>
                    <option value="+375">🇧🇾 +375</option>
                    <option value="+32">🇧🇪 +32</option>
                    <option value="+501">🇧🇿 +501</option>
                    <option value="+229">🇧🇯 +229</option>
                    <option value="+975">🇧🇹 +975</option>
                    <option value="+591">🇧🇴 +591</option>
                    <option value="+387">🇧🇦 +387</option>
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+673">🇧🇳 +673</option>
                    <option value="+359">🇧🇬 +359</option>
                    <option value="+226">🇧🇫 +226</option>
                    <option value="+257">🇧🇮 +257</option>
                    <option value="+855">🇰🇭 +855</option>
                    <option value="+237">🇨🇲 +237</option>
                    <option value="+1">🇨🇦 +1</option>
                    <option value="+86">🇨🇳 +86</option>
                    <option value="+57">🇨🇴 +57</option>
                    <option value="+506">🇨🇷 +506</option>
                    <option value="+385">🇭🇷 +385</option>
                    <option value="+53">🇨🇺 +53</option>
                    <option value="+357">🇨🇾 +357</option>
                    <option value="+420">🇨🇿 +420</option>
                    <option value="+45">🇩🇰 +45</option>
                    <option value="+253">🇩🇯 +253</option>
                    <option value="+593">🇪🇨 +593</option>
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+503">🇸🇻 +503</option>
                    <option value="+372">🇪🇪 +372</option>
                    <option value="+251">🇪🇹 +251</option>
                    <option value="+358">🇫🇮 +358</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+995">🇬🇪 +995</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+233">🇬🇭 +233</option>
                    <option value="+30">🇬🇷 +30</option>
                    <option value="+502">🇬🇹 +502</option>
                    <option value="+509">🇭🇹 +509</option>
                    <option value="+504">🇭🇳 +504</option>
                    <option value="+852">🇭🇰 +852</option>
                    <option value="+36">🇭🇺 +36</option>
                    <option value="+354">🇮🇸 +354</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+62">🇮🇩 +62</option>
                    <option value="+98">🇮🇷 +98</option>
                    <option value="+964">🇮🇶 +964</option>
                    <option value="+353">🇮🇪 +353</option>
                    <option value="+972">🇮🇱 +972</option>
                    <option value="+39">🇮🇹 +39</option>
                    <option value="+81">🇯🇵 +81</option>
                    <option value="+962">🇯🇴 +962</option>
                    <option value="+7">🇰🇿 +7</option>
                    <option value="+254">🇰🇪 +254</option>
                    <option value="+965">🇰🇼 +965</option>
                    <option value="+996">🇰🇬 +996</option>
                    <option value="+371">🇱🇻 +371</option>
                    <option value="+961">🇱🇧 +961</option>
                    <option value="+218">🇱🇾 +218</option>
                    <option value="+423">🇱🇮 +423</option>
                    <option value="+370">🇱🇹 +370</option>
                    <option value="+352">🇱🇺 +352</option>
                    <option value="+853">🇲🇴 +853</option>
                    <option value="+60">🇲🇾 +60</option>
                    <option value="+960">🇲🇻 +960</option>
                    <option value="+223">🇲🇱 +223</option>
                    <option value="+356">🇲🇹 +356</option>
                    <option value="+52">🇲🇽 +52</option>
                    <option value="+373">🇲🇩 +373</option>
                    <option value="+377">🇲🇨 +377</option>
                    <option value="+976">🇲🇳 +976</option>
                    <option value="+382">🇲🇪 +382</option>
                    <option value="+212">🇲🇦 +212</option>
                    <option value="+258">🇲🇿 +258</option>
                    <option value="+95">🇲🇲 +95</option>
                    <option value="+264">🇳🇦 +264</option>
                    <option value="+977">🇳🇵 +977</option>
                    <option value="+31">🇳🇱 +31</option>
                    <option value="+64">🇳🇿 +64</option>
                    <option value="+505">🇳🇮 +505</option>
                    <option value="+227">🇳🇪 +227</option>
                    <option value="+234">🇳🇬 +234</option>
                    <option value="+850">🇰🇵 +850</option>
                    <option value="+47">🇳🇴 +47</option>
                    <option value="+968">🇴🇲 +968</option>
                    <option value="+92">🇵🇰 +92</option>
                    <option value="+970">🇵🇸 +970</option>
                    <option value="+507">🇵🇦 +507</option>
                    <option value="+595">🇵🇾 +595</option>
                    <option value="+51">🇵🇪 +51</option>
                    <option value="+63">🇵🇭 +63</option>
                    <option value="+48">🇵🇱 +48</option>
                    <option value="+351">🇵🇹 +351</option>
                    <option value="+974">🇶🇦 +974</option>
                    <option value="+40">🇷🇴 +40</option>
                    <option value="+7">🇷🇺 +7</option>
                    <option value="+250">🇷🇼 +250</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+221">🇸🇳 +221</option>
                    <option value="+381">🇷🇸 +381</option>
                    <option value="+65">🇸🇬 +65</option>
                    <option value="+421">🇸🇰 +421</option>
                    <option value="+386">🇸🇮 +386</option>
                    <option value="+27">🇿🇦 +27</option>
                    <option value="+82">🇰🇷 +82</option>
                    <option value="+34">🇪🇸 +34</option>
                    <option value="+94">🇱🇰 +94</option>
                    <option value="+249">🇸🇩 +249</option>
                    <option value="+46">🇸🇪 +46</option>
                    <option value="+41">🇨🇭 +41</option>
                    <option value="+963">🇸🇾 +963</option>
                    <option value="+886">🇹🇼 +886</option>
                    <option value="+992">🇹🇯 +992</option>
                    <option value="+255">🇹🇿 +255</option>
                    <option value="+66">🇹🇭 +66</option>
                    <option value="+228">🇹🇬 +228</option>
                    <option value="+216">🇹🇳 +216</option>
                    <option value="+90">🇹🇷 +90</option>
                    <option value="+993">🇹🇲 +993</option>
                    <option value="+256">🇺🇬 +256</option>
                    <option value="+380">🇺🇦 +380</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+598">🇺🇾 +598</option>
                    <option value="+998">🇺🇿 +998</option>
                    <option value="+58">🇻🇪 +58</option>
                    <option value="+84">🇻🇳 +84</option>
                    <option value="+967">🇾🇪 +967</option>
                    <option value="+260">🇿🇲 +260</option>
                    <option value="+263">🇿🇼 +263</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={phoneNumber.split(' ')[1] || phoneNumber}
                    onChange={e => {
                      const code = phoneNumber.split(' ')[0] || '+91';
                      setPhoneNumber(`${code} ${e.target.value.replace(/\D/g, '')}`);
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
                  disabled={loading}
                >
                  {loading ? 'Sending OTP...' : 'Continue'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 text-center">
                  OTP sent to {phoneNumber}
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="ml-2 text-blue-600 underline"
                  >
                    Change
                  </button>
                </p>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  className="border rounded-lg px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  maxLength="6"
                />
                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className="text-sm text-blue-600 hover:underline"
                  disabled={loading}
                >
                  Resend OTP
                </button>
              </>
            )}
          </div>
        ) : (
          // Email Authentication
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
        )}
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
        
        {/* Invisible reCAPTCHA container */}
        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
};

export default SignInModal;
