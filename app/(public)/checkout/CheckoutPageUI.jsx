"use client";

import React, { useState, useEffect } from "react";
import { countryCodes } from "@/assets/countryCodes";
import { indiaStatesAndDistricts } from "@/assets/indiaStatesAndDistricts";
import { useSelector, useDispatch } from "react-redux";
import { fetchAddress } from "@/lib/features/address/addressSlice";
import { clearCart } from "@/lib/features/cart/cartSlice";
import { fetchProducts } from "@/lib/features/product/productSlice";
import { fetchShippingSettings, calculateShipping } from "@/lib/shipping";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import dynamic from "next/dynamic";

const SignInModal = dynamic(() => import("@/components/SignInModal"), { ssr: false });
const AddressModal = dynamic(() => import("@/components/AddressModal"), { ssr: false });

export default function CheckoutPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const dispatch = useDispatch();
  const addressList = useSelector((state) => state.address?.list || []);
  const addressFetchError = useSelector((state) => state.address?.error);
  const { cartItems } = useSelector((state) => state.cart);
  const products = useSelector((state) => state.product.list);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    district: '',
    street: '',
  });

  const keralaDistricts = indiaStatesAndDistricts.find(s => s.state === 'Kerala')?.districts || [];
  const [districts, setDistricts] = useState(keralaDistricts);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [shippingSetting, setShippingSetting] = useState(null);
  const [shipping, setShipping] = useState(0);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Coupon logic
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState("");
  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (!coupon.trim()) {
      setCouponError("Enter a coupon code to see discount.");
      return;
    }
    setCouponError("");
    // TODO: Add real coupon validation logic here
  };

  const router = useRouter();

  // Fetch products if not loaded
  useEffect(() => {
    if (!products || products.length === 0) {
      dispatch(fetchProducts({}));
    }
  }, [dispatch, products]);

  // Fetch addresses for logged-in users
  useEffect(() => {
    if (user && getToken) {
      dispatch(fetchAddress({ getToken }));
    }
  }, [user, getToken, dispatch]);

  // Auto-select first address
  useEffect(() => {
    if (user && addressList.length > 0 && !form.addressId) {
      setForm((f) => ({ ...f, addressId: addressList[0]._id }));
    }
  }, [user, addressList, form.addressId]);

  // Build cart array
  const cartArray = [];
  console.log('Checkout - Cart Items:', cartItems);
  console.log('Checkout - Products:', products?.map(p => ({ id: p._id, name: p.name })));
  
  for (const [key, value] of Object.entries(cartItems || {})) {
    const product = products?.find((p) => String(p._id) === String(key));
    if (product) {
      console.log('Found product for key:', key, product.name);
      cartArray.push({ ...product, quantity: value });
    } else {
      console.log('No product found for key:', key);
    }
  }
  
  console.log('Checkout - Final Cart Array:', cartArray);

  const subtotal = cartArray.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + shipping;

  // Load shipping settings
  useEffect(() => {
    async function loadShipping() {
      const setting = await fetchShippingSettings();
      setShippingSetting(setting);
    }
    loadShipping();
  }, []);

  // Calculate dynamic shipping based on settings
  useEffect(() => {
    if (shippingSetting && cartArray.length > 0) {
      const calculatedShipping = calculateShipping({ cartItems: cartArray, shippingSetting });
      setShipping(calculatedShipping);
    } else {
      setShipping(0);
    }
  }, [shippingSetting, cartArray]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'state') {
      // Update districts when state changes
      const stateObj = indiaStatesAndDistricts.find(s => s.state === value);
      setDistricts(stateObj ? stateObj.districts : []);
      setForm(f => ({ ...f, state: value, district: '' }));
    } else if (name === 'country') {
      setForm(f => ({ ...f, country: value, state: '', district: '' }));
      if (value !== 'India') setDistricts([]);
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const [formError, setFormError] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    // Validate required fields
    if (cartArray.length === 0) {
      setFormError("Your cart is empty.");
      return;
    }
    setPlacingOrder(true);
    try {
      let addressId = form.addressId;
      // If logged in and no address selected, skip address creation for now
      // Orders can work without addressId
      
      // Validate payment method
      if (user && !form.payment) {
        setFormError("Please select a payment method.");
        setPlacingOrder(false);
        return;
      }
      if (!user) {
        if (!form.name || !form.email || !form.phone || !form.street || !form.city || !form.district) {
          setFormError("Please fill all required shipping details.");
          setPlacingOrder(false);
          return;
        }
        if (!form.payment) {
          setFormError("Please select a payment method.");
          setPlacingOrder(false);
          return;
        }
      }
      // Build order payload
      let payload;
      
      console.log('Checkout - User state:', user ? 'logged in' : 'guest');
      console.log('Checkout - User object:', user);
      
      if (user) {
        console.log('Building logged-in user payload...');
        payload = {
          items: cartArray.map(({ _id, quantity }) => ({ id: _id, quantity })),
          paymentMethod: form.payment === 'cod' ? 'COD' : form.payment.toUpperCase(),
          shippingFee: shipping,
        };
        // Only add addressId if it exists
        if (addressId || (addressList[0] && addressList[0]._id)) {
          payload.addressId = addressId || addressList[0]._id;
        } else if (form.street && form.city && form.state && form.country) {
          // User is logged in but has no saved address - include address in payload
          payload.addressData = {
            name: form.name || user.displayName || '',
            email: form.email || user.email || '',
            phone: form.phone || '',
            street: form.street,
            city: form.city,
            state: form.state,
            country: form.country || 'UAE',
            zip: form.zip || form.pincode || '000000',
            district: form.district || ''
          };
        }
      } else {
        console.log('Building guest payload...');
        payload = {
          isGuest: true,
          guestInfo: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            city: form.city,
            district: form.district,
            street: form.street,
            note: form.note,
          },
          items: cartArray.map(({ _id, quantity }) => ({ id: _id, quantity })),
          paymentMethod: form.payment === 'cod' ? 'COD' : form.payment.toUpperCase(),
          shippingFee: shipping,
        };
      }
      
      console.log('Submitting order:', payload);
      
      let fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };
      
      if (user && getToken) {
        console.log('Adding Authorization header for logged-in user...');
        const token = await getToken();
        console.log('Got token:', token ? 'yes' : 'no');
        fetchOptions.headers = {
          ...fetchOptions.headers,
          Authorization: `Bearer ${token}`,
        };
      } else {
        console.log('No Authorization header - guest checkout');
      }
      
      console.log('Final fetch options:', { ...fetchOptions, body: 'payload' });
      
      const res = await fetch("/api/orders", fetchOptions);
      if (!res.ok) {
        const errorText = await res.text();
        let msg = errorText;
        try {
          const data = JSON.parse(errorText);
          msg = data.message || data.error || errorText;
        } catch {}
        setFormError(msg);
        setPlacingOrder(false);
        return;
      }
      const data = await res.json();
      // Show loader until order is confirmed
      setPlacingOrder(true);
      setTimeout(() => {
        dispatch(clearCart());
        router.push(`/order-success?orderId=${data._id || data.id}`);
        setPlacingOrder(false);
      }, 1200); // 1.2s loader for better UX
    } catch (err) {
      setFormError(err.message || "Order failed. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  // Set default payment method to COD on mount
  useEffect(() => {
    setForm((f) => ({ ...f, payment: f.payment || 'cod' }));
  }, []);

  if (authLoading) return null;
  
  // Show loading state while products are being fetched
  if (!products || products.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-gray-600">Loading your cart...</div>
      </div>
    );
  }
  
  if (!cartItems || Object.keys(cartItems).length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</div>
        <button 
          onClick={() => router.push('/shop')}
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="py-10 bg-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column: address, form, payment */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            {/* Cart Items Section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-gray-900">Cart Items</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cartArray.map((item) => (
                  <div key={item._id} className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-3 gap-3">
                    <img src={item.image || item.images?.[0] || '/placeholder.png'} alt={item.name} className="w-14 h-14 object-cover rounded-md border" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{item.name}</div>
                      <div className="text-xs text-gray-500 truncate">{item.brand || ''}</div>
                      <div className="text-xs text-gray-400">AED {item.price.toLocaleString()}</div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <button type="button" className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300" onClick={() => {
                          if (item.quantity > 1) {
                            dispatch({ type: 'cart/removeFromCart', payload: { productId: item._id } });
                          }
                        }}>-</button>
                        <span className="px-2 text-sm">{item.quantity}</span>
                        <button type="button" className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300" onClick={() => {
                          dispatch({ type: 'cart/addToCart', payload: { productId: item._id } });
                        }}>+</button>
                      </div>
                      <button type="button" className="text-xs text-red-500 hover:underline mt-1" onClick={() => {
                        dispatch({ type: 'cart/deleteItemFromCart', payload: { productId: item._id } });
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Shipping Method Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2 text-gray-900">Choose Shipping Method</h2>
              {/* Only one shipping method for now, auto-selected */}
              <div className="border border-green-400 bg-green-50 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-900">{shipping === 0 ? 'Free Shipping' : 'Standard Shipping'}</div>
                  <div className="text-xs text-gray-600">Delivered within {shippingSetting?.estimatedDays || '2-5'} business days</div>
                </div>
                <div className="font-bold text-green-900 text-lg">{shipping === 0 ? 'Free' : `AED ${shipping.toLocaleString()}`}</div>
              </div>
            </div>
            {/* Shipping Details Section */}
            <form id="checkout-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
              {formError && <div className="text-red-600 font-semibold mb-2">{formError}</div>}
              
              {/* Guest Checkout Notice */}
              {!user && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-blue-900 mb-1">Checkout as Guest</h3>
                      <p className="text-sm text-blue-800">You can place your order without creating an account.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSignIn(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-semibold underline whitespace-nowrap ml-4"
                    >
                      Sign In Instead
                    </button>
                  </div>
                </div>
              )}
              
              <h2 className="text-xl font-bold mb-2 text-gray-900">Shipping details</h2>
              {/* ...existing code for address/guest form... */}
              {/* Show address fetch error if present */}
              {addressFetchError && (
                <div className="text-red-600 font-semibold mb-2">
                  {addressFetchError === 'Unauthorized' ? (
                    <>
                      You are not logged in or your session expired. <button className="underline text-blue-600" type="button" onClick={() => setShowSignIn(true)}>Sign in again</button>.
                    </>
                  ) : addressFetchError}
                </div>
              )}
              {addressList.length > 0 && !showAddressModal && !addressFetchError ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-900">{addressList[0].name}</div>
                    <div className="text-blue-700 text-sm">{addressList[0].district || addressList[0].city}</div>
                    <div className="text-gray-800 text-sm">{addressList[0].street}</div>
                    <div className="text-gray-800 text-sm">{addressList[0].city}, {addressList[0].state}, {addressList[0].country}</div>
                    <div className="text-orange-500 text-sm font-semibold">{addressList[0].phoneCode} {addressList[0].phone}</div>
                    <div className="flex flex-col gap-1 mt-2 text-xs text-gray-700">
                      <span>Total: <span className="font-bold">AED {subtotal.toLocaleString()}</span></span>
                      <span className="text-gray-500">Delivery charge: <span className="font-bold">AED {shipping.toLocaleString()}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button type="button" className="text-blue-600 text-xs font-semibold hover:underline" onClick={() => setShowAddressModal(true)}>
                      Change address
                    </button>
                    <button type="button" className="text-blue-600 text-xs font-semibold hover:underline" onClick={() => setShowAddressModal(true)}>
                      Add new address
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 mb-4">
                                    {/* Hidden country field, default UAE */}
                                    <input type="hidden" name="country" value={form.country || 'UAE'} />
                  {/* Name */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="name"
                    placeholder="Name"
                    value={form.name || ''}
                    onChange={handleChange}
                    required
                  />
                  {/* Email (optional) */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="email"
                    name="email"
                    placeholder="Email address (optional)"
                    value={form.email || ''}
                    onChange={handleChange}
                  />
                  {/* Phone input with country code selector */}
                  <div className="flex gap-2">
                    <select
                      className="border border-gray-200 bg-white rounded px-2 py-2 focus:border-gray-400"
                      name="phoneCode"
                      value={form.phoneCode}
                      onChange={handleChange}
                      style={{ maxWidth: '110px' }}
                      required
                    >
                      {countryCodes.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <input
                      className="border border-gray-200 bg-white rounded px-4 py-2 flex-1 focus:border-gray-400"
                      type="tel"
                      name="phone"
                      placeholder="Phone number"
                      value={form.phone || ''}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  {/* City */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="city"
                    placeholder="City"
                    value={form.city || ''}
                    onChange={handleChange}
                    required
                  />
                  {/* Area/District */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="district"
                    placeholder="Area / District"
                    value={form.district || ''}
                    onChange={handleChange}
                    required
                  />
                  {/* Street name, building, apartment */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="street"
                    placeholder="Street name, building number, apartment number"
                    value={form.street || ''}
                    onChange={handleChange}
                    required
                  />
                  {/* Add a note */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="note"
                    placeholder="Add a note"
                    value={form.note || ''}
                    onChange={handleChange}
                  />
                </div>
              )}
              <h2 className="text-xl font-bold mb-2 text-gray-900">Payment methods</h2>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-4">
                <div className="flex flex-col gap-0">
                  <label className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-lg border ${form.payment === 'cod' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={form.payment === 'cod'}
                      onChange={handleChange}
                      className={`accent-red-600 w-5 h-5 ${form.payment === 'cod' ? 'ring-2 ring-red-500' : ''}`}
                    />
                    <span className={`font-semibold flex items-center gap-2 ${form.payment === 'cod' ? 'text-red-600' : 'text-gray-900'}`}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="${form.payment === 'cod' ? 'text-red-600' : 'text-gray-400'}"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10v4"/><path d="M10 10v4"/><path d="M14 10v4"/><path d="M18 10v4"/></svg>
                      Cash on Delivery
                    </span>
                  </label>
                  <div className="pl-12 pt-2 pb-1 text-gray-600 text-sm">Cash on Delivery</div>
                </div>
              </div>
            </form>
          </div>
        </div>
        {/* Right column: discount input, order summary and place order button */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 h-fit flex flex-col justify-between">
          {/* Discount/Coupon input */}
          <form onSubmit={handleApplyCoupon} className="mb-4 flex gap-2">
            <input
              type="text"
              className="border border-gray-200 rounded px-3 py-2 flex-1 focus:border-gray-400"
              placeholder="Discount code or coupon"
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
            >
              Apply
            </button>
          </form>
          {couponError && <div className="text-red-500 text-xs mb-2">{couponError}</div>}
          <h2 className="font-bold text-lg mb-2 text-gray-900">Order details</h2>
          <div className="flex justify-between text-sm text-gray-900 mb-2">
            <span>Items</span>
            <span>AED {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-900 mb-2">
            <span>Shipping &amp; handling</span>
            <span>{shipping > 0 ? `AED ${shipping.toLocaleString()}` : 'AED 0'}</span>
          </div>
          <hr className="my-2" />
          <div className="flex justify-between font-bold text-base text-gray-900 mb-4">
            <span>Total</span>
            <span>AED {total.toLocaleString()}</span>
          </div>
          <div className="md:static md:mb-0 fixed bottom-16 left-0 right-0 z-50" style={{maxWidth: '100vw'}}>
            <button
              type="submit"
              form="checkout-form"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-4 text-xl transition shadow-2xl md:w-full md:rounded md:text-lg"
              style={{borderRadius: '0', boxShadow: '0 -2px 16px rgba(0,0,0,0.10)', marginBottom: '4px', letterSpacing: '0.5px'}}
              disabled={placingOrder}
            >
              {placingOrder ? "Placing order..." : "Place order"}
            </button>
          </div>
        </div>
      </div>
      <AddressModal open={showAddressModal} setShowAddressModal={setShowAddressModal} onAddressAdded={(addr) => {
        setForm(f => ({ ...f, addressId: addr._id }));
        dispatch(fetchAddress({ getToken }));
      }} />
      <SignInModal open={showSignIn} onClose={() => setShowSignIn(false)} />
    </div>
  );
}