'use client';

import { PackageIcon, Search, ShoppingCart, LifeBuoy, Menu, X, HeartIcon, StarIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { auth } from '../lib/firebase';
import { getAuth } from "firebase/auth";
console.log("Firebase UID:", getAuth().currentUser?.uid);
import Image from 'next/image';
import axios from "axios";
import toast from "react-hot-toast";
import Logo from "../assets/logo/logo3.png";
import Truck from '../assets/delivery.png';
import SignInModal from './SignInModal';

const Navbar = () => {
  // (already declared above)
  // State for categories
  const [categories, setCategories] = useState([]);
  // State for animated search placeholder
  const [searchPlaceholder, setSearchPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [productIndex, setProductIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [supportDropdownOpen, setSupportDropdownOpen] = useState(false);
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const hoverTimer = useRef(null);
  const categoryTimer = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const cartCount = useSelector((state) => state.cart.total);
  const [signInOpen, setSignInOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(undefined);

  // Show sign-in modal automatically on mobile for guest users
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && !firebaseUser) {
      setSignInOpen(true);
    }
  }, [firebaseUser]);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  // (already declared above)

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (data.categories) {
          setCategories(data.categories);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Product names for animated placeholder
  const productNames = [
    "Wireless Headphones",
    "Smart Watch",
    "Running Shoes",
    "Coffee Maker",
    "Gaming Mouse",
    "Yoga Mat",
    "Sunglasses",
    "Laptop Bag",
    "Water Bottle",
    "Phone Case"
  ];

  // Typewriter effect for search placeholder
  useEffect(() => {
    const currentProduct = productNames[productIndex];
    const typingSpeed = isDeleting ? 50 : 100;
    
    const timer = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (searchPlaceholder.length < currentProduct.length) {
          setSearchPlaceholder(currentProduct.substring(0, searchPlaceholder.length + 1));
        } else {
          // Wait before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting
        if (searchPlaceholder.length > 0) {
          setSearchPlaceholder(searchPlaceholder.substring(0, searchPlaceholder.length - 1));
        } else {
          // Move to next product
          setIsDeleting(false);
          setProductIndex((prev) => (prev + 1) % productNames.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [searchPlaceholder, isDeleting, productIndex, productNames]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      console.log("Navbar user:", user);
    });
    return () => unsubscribe();
  }, []);

  // Listen for custom event to open sign in modal
  useEffect(() => {
    const handleOpenSignInModal = () => {
      setSignInOpen(true);
    };
    window.addEventListener('openSignInModal', handleOpenSignInModal);
    return () => window.removeEventListener('openSignInModal', handleOpenSignInModal);
  }, []);

  useEffect(() => {
    const fetchIfLoggedIn = () => {
      if (auth.currentUser) {
        fetchWishlistCount();
      } else {
        // Get guest wishlist count from localStorage
        try {
          const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
          setWishlistCount(Array.isArray(guestWishlist) ? guestWishlist.length : 0);
        } catch {
          setWishlistCount(0);
        }
      }
    };
    fetchIfLoggedIn();
    // Listen for wishlist updates
    const handleWishlistUpdate = () => {
      fetchIfLoggedIn();
    };
    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => {
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
    };
  }, []);

  const fetchWishlistCount = async () => {
    try {
      if (!auth.currentUser) {
        // Get guest wishlist count from localStorage
        try {
          const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
          setWishlistCount(Array.isArray(guestWishlist) ? guestWishlist.length : 0);
        } catch {
          setWishlistCount(0);
        }
        return;
      }
      const token = await auth.currentUser.getIdToken();
      const { data } = await axios.get('/api/wishlist', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setWishlistCount(data.wishlist?.length || 0);
    } catch (error) {
      console.error('Error fetching wishlist count:', error);
      setWishlistCount(0);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(`/shop?search=${search}`);
  };

  const handleCartClick = (e) => {
    e.preventDefault();
    if (!cartCount || cartCount === 0) {
      toast.error("Your cart is empty. Add some products to get started!", {
        duration: 3000,
        icon: '🛒',
      });
      return;
    }
    router.push("/cart");
  };
  

  // Seller approval check (fetch from backend) - Only check, don't show toast
  const [isSeller, setIsSeller] = useState(false);
  const [isSellerLoading, setIsSellerLoading] = useState(false);
  const lastCheckedUidRef = useRef(null);
  useEffect(() => {
    const uid = firebaseUser?.uid || null;
    if (!uid) {
      setIsSeller(false);
      setIsSellerLoading(false);
      lastCheckedUidRef.current = null;
      return;
    }
    if (lastCheckedUidRef.current === uid) {
      // Already checked for this UID; no need to re-call API
      return;
    }
    lastCheckedUidRef.current = uid;
    const checkSeller = async () => {
      setIsSellerLoading(true);
      try {
        const token = await firebaseUser.getIdToken(true);
        const { data } = await axios.get('/api/store/is-seller', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsSeller(!!data.isSeller);
        setIsSellerLoading(false);
      } catch (err) {
        try {
          const token2 = await firebaseUser.getIdToken(true);
          const { data } = await axios.get('/api/store/is-seller', {
            headers: { Authorization: `Bearer ${token2}` },
          });
          setIsSeller(!!data.isSeller);
          setIsSellerLoading(false);
        } catch {
          setIsSeller(false);
          setIsSellerLoading(false);
        }
      }
    };
    checkSeller();
  }, [firebaseUser?.uid]);

  return (
    <>
      {/* Mobile-Only Simple Navbar for Non-Home Pages */}
      {!isHomePage && (
        <nav className="lg:hidden sticky top-0 z-50" style={{backgroundColor: '#B91519'}}>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Back Button */}
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="p-1">
                <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full border border-transparent">
                  <Search size={16} className="text-gray-500 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search for products"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-700 text-sm"
                  />
                </div>
              </div>
            </form>

            {/* Cart Icon */}
            <button onClick={handleCartClick} className="relative p-2 hover:bg-gray-100 rounded-full transition flex-shrink-0">
              <ShoppingCart size={20} className="text-gray-700" />
              {isClient && cartCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </nav>
      )}

      {/* Original Full Navbar (Hidden on mobile for non-home pages) */}
      <nav className={`relative z-50 shadow-sm ${!isHomePage ? 'hidden lg:block' : ''}`} style={{ backgroundColor: '#B91519', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 transition-all">

          {/* Left Side - Hamburger (Mobile) + Logo */}
          <div className="flex items-center gap-2">
            {/* Hamburger Menu - Mobile Only on Home Page */}
            {isHomePage && (
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                className="lg:hidden p-2 hover:bg-white/20 rounded-full transition"
              >
                {mobileMenuOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
              </button>
            )}
            
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <Image src={Logo} alt="Brandstored Logo" width={180} height={45} className="object-contain" priority />
            </Link>
          </div>

          {/* Center - Links and Search */}
          <div className="hidden lg:flex items-center flex-1 justify-center gap-6 px-8">
            <Link href="/top-selling" className="text-sm font-medium text-white hover:text-orange-500 transition whitespace-nowrap flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              Top Selling Items
            </Link>
            <Link href="/new" className="text-sm font-medium text-white hover:text-orange-500 transition whitespace-nowrap flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              New
            </Link>

            <Link href="/5-star-rated" className="text-sm font-medium text-white hover:text-orange-500 transition whitespace-nowrap flex items-center gap-1.5">
              <StarIcon size={16} className="text-orange-500" fill="#f97316" />
              5 Star Rated
            </Link>

         
            
            {/* Categories Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => {
                if (categoryTimer.current) clearTimeout(categoryTimer.current);
                setCategoriesDropdownOpen(true);
              }}
              onMouseLeave={() => {
                if (categoryTimer.current) clearTimeout(categoryTimer.current);
                categoryTimer.current = setTimeout(() => {
                  setCategoriesDropdownOpen(false);
                  setHoveredCategory(null);
                }, 200);
              }}
            >
              <button className="text-sm font-medium text-white hover:text-orange-500 transition whitespace-nowrap flex items-center gap-1">
                Categories
                <svg className={`w-4 h-4 transition-transform ${categoriesDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {categoriesDropdownOpen && categories.length > 0 && (
                <div className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden flex">
                  {/* Main Categories */}
                  <div className="w-64 bg-gray-50 border-r border-gray-200">
                    {categories.filter(cat => !cat.parentId).map((category) => {
                      const categorySlug = category.slug || category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                      return (
                        <div
                          key={category._id}
                          className="relative"
                          onMouseEnter={() => setHoveredCategory(category._id)}
                        >
                          <Link
                            href={`/shop?category=${categorySlug}`}
                            className={`flex items-center justify-between px-4 py-3 hover:bg-orange-50 transition ${
                              hoveredCategory === category._id ? 'bg-orange-50 text-orange-600' : 'text-gray-700'
                            }`}
                            onClick={() => {
                              setCategoriesDropdownOpen(false);
                              setHoveredCategory(null);
                            }}
                          >
                            <span className="font-medium">{category.name}</span>
                            {category.children && category.children.length > 0 && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </Link>
                        </div>
                      );
                    })}
                  </div>

                  {/* Subcategories */}
                  {hoveredCategory && (
                    <div className="w-64 bg-white p-4">
                      {categories
                        .find(cat => cat._id === hoveredCategory)
                        ?.children?.map((subcat) => {
                          const subcatSlug = subcat.slug || subcat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                          return (
                            <Link
                              key={subcat._id}
                              href={`/shop?category=${subcatSlug}`}
                              className="block px-3 py-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded transition"
                              onClick={() => {
                                setCategoriesDropdownOpen(false);
                                setHoveredCategory(null);
                              }}
                            >
                              {subcat.name}
                            </Link>
                          );
                        })}
                      {(!categories.find(cat => cat._id === hoveredCategory)?.children?.length) && (
                        <p className="text-sm text-gray-400 px-3 py-2">No subcategories</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex items-center w-full max-w-md text-sm gap-2 bg-gray-100 px-4 py-2.5 rounded-full border border-gray-200 focus-within:border-orange-300 focus-within:ring-1 focus-within:ring-orange-200 transition">
              <Search size={18} className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                placeholder={searchPlaceholder || "Search products"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-700"
                required
              />
            </form>
          </div>

          {/* Right Side - Actions */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            {/* Login/User Button */}
            {firebaseUser ? (
              <div
                className="relative flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full cursor-pointer group"
                onMouseEnter={() => setUserDropdownOpen(true)}
                onMouseLeave={() => setUserDropdownOpen(false)}
              >
                {firebaseUser.photoURL ? (
                  <Image src={firebaseUser.photoURL} alt="User" width={32} height={32} className="rounded-full object-cover" />
                ) : (
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg">
                    {firebaseUser.displayName?.[0]?.toUpperCase() || firebaseUser.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                )}
                <span className="font-medium text-gray-700 text-sm">Hi, {firebaseUser.displayName || firebaseUser.email}</span>
                {/* Dashboard button for seller */}
                {isSeller && (
                  <button
                    className="ml-2 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-full transition"
                    onClick={() => router.push('/store')}
                  >
                    Dashboard
                  </button>
                )}
                {/* User Dropdown */}
                {userDropdownOpen && (
                  <div className="absolute right-0 top-12 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
                    <Link
                      href="/dashboard/profile"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/orders"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      My Orders
                    </Link>
                    <Link
                      href="/browse-history"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      Browse History
                    </Link>
                    <div className="my-1 border-t border-gray-200" />
                    <button
                      className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                      onClick={async () => {
                        await auth.signOut();
                        setUserDropdownOpen(false);
                        router.push('/');
                        toast.success('Signed out successfully');
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSignInOpen(true)}
                className="px-5 py-2 bg-transparent border border-white text-white hover:bg-white/10 transition text-sm font-medium rounded-full"
              >
                Login
              </button>
            )}

            {/* Support Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                setSupportDropdownOpen(true);
              }}
              onMouseLeave={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                hoverTimer.current = setTimeout(() => setSupportDropdownOpen(false), 200);
              }}
            >
              {/* <button
                onClick={() => setSupportDropdownOpen((v) => !v)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full flex items-center gap-2 transition text-sm font-medium"
                aria-haspopup="menu"
                aria-expanded={supportDropdownOpen}
              >
                <LifeBuoy size={16} /> Support
              </button> */}
              {supportDropdownOpen && (
                <ul
                  className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 text-sm text-gray-700 z-50 overflow-hidden"
                  onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    setSupportDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => setSupportDropdownOpen(false), 200);
                  }}
                  role="menu"
                >
                  <li><Link href="/faq" className="block px-4 py-2.5 hover:bg-gray-50 transition">FAQ</Link></li>
                  <li><Link href="/support" className="block px-4 py-2.5 hover:bg-gray-50 transition">Support</Link></li>
                  <li><Link href="/terms" className="block px-4 py-2.5 hover:bg-gray-50 transition">Terms & Conditions</Link></li>
                  <li><Link href="/privacy-policy" className="block px-4 py-2.5 hover:bg-gray-50 transition">Privacy Policy</Link></li>
                  <li><Link href="/return-policy" className="block px-4 py-2.5 hover:bg-gray-50 transition">Return Policy</Link></li>
                </ul>
              )}
            </div>

            {/* Wishlist */}
            <Link href={firebaseUser ? "/dashboard/wishlist" : "/wishlist"} className="relative p-2 hover:bg-white/20 rounded-full transition group">
              <HeartIcon size={22} className="text-white group-hover:text-orange-500 transition" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-orange-500 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <button onClick={handleCartClick} className="relative p-2 hover:bg-white/20 rounded-full transition group">
  <ShoppingCart size={22} className="text-white group-hover:text-orange-500 transition" />
  {isClient && cartCount > 0 && (
    <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
      {cartCount}
    </span>
  )}
</button>

          </div>


          {/* Mobile Right Side - Login Icon + Cart */}
          <div className="lg:hidden flex items-center gap-3">
            {/* Show user avatar if signed in, else login icon */}
            {isHomePage && (
              firebaseUser ? (
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                >
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={28} height={28} className="rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-base">
                      {firebaseUser.displayName?.[0]?.toUpperCase() || firebaseUser.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setSignInOpen(true)}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </button>
              )
            )}
            
            <button onClick={handleCartClick} className="relative p-2">
              <ShoppingCart size={20} className="text-white" />
              {isClient && cartCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar - Below main navbar on mobile */}
        <div className="lg:hidden pb-3" style={{ backgroundColor: '#B91519' }}>
          <form onSubmit={handleSearch} className="flex items-center text-sm gap-2 bg-gray-100 mx-4 px-4 py-2.5 rounded-full border border-gray-200">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder={searchPlaceholder || "Search products"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-700"
              required
            />
          </form>
        </div>

        {/* Mobile Overlay Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 z-[9999]" onClick={() => setMobileMenuOpen(false)}>
            <div 
              className="absolute top-0 left-0 w-3/4 max-w-sm h-full bg-white shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto animate-slideIn" 
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'slideInLeft 0.3s ease-out' }}
            >
              {/* Header with Logo and Close Button */}
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <Image src={Logo} alt="Brandstored Logo" width={120} height={35} className="object-contain" />
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition">
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              {/* User Section */}
              {firebaseUser === undefined ? null : !firebaseUser ? (
                <button
                  type="button"
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition mb-4"
                  onClick={() => {
                    setSignInOpen(true);
                    setMobileMenuOpen(false);
                  }}
                >
                  Login
                </button>
              ) : (
                <div className="w-full px-4 py-3 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full mb-4 flex items-center gap-2">
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={28} height={28} className="rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-base">
                      {firebaseUser.displayName?.[0]?.toUpperCase() || firebaseUser.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                  <span className="font-medium">Hi, {firebaseUser.displayName || firebaseUser.email}</span>
                </div>
              )}

              {/* Links */}
              <div className="flex flex-col gap-1">
                {firebaseUser && (
                  <>
                    <Link 
                      href="/dashboard/profile" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>Profile</span>
                    </Link>
                    <Link 
                      href="/dashboard/orders" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <PackageIcon size={18} className="text-gray-600" />
                      <span>My Orders</span>
                    </Link>
                    <Link 
                      href="/browse-history" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>Browse History</span>
                    </Link>
                    <button
                      className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 rounded-lg transition text-red-600 font-medium mt-2"
                      onClick={async () => {
                        await auth.signOut();
                        setMobileMenuOpen(false);
                        toast.success('Signed out successfully');
                        window.location.reload();
                      }}
                    >
                      Sign Out
                    </button>
                    <div className="px-4"><div className="h-px bg-gray-200 my-2" /></div>
                  </>
                )}
                <Link 
                  href="/top-selling" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Top Selling Items
                </Link>
                <Link 
                  href="/new" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  New Arrivals
                </Link>

                <Link 
                  href="/5-star-rated" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <StarIcon size={18} className="text-orange-500" fill="#FFA500" />
                  5 Star Rated
                </Link>

                <Link 
                  href="/fast-delivery" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                  </svg>
                  Fast Delivery
                </Link>

                <Link 
                  href={firebaseUser ? "/dashboard/wishlist" : "/wishlist"}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <HeartIcon size={18} className="text-orange-500" />
                    <span>Wishlist</span>
                  </div>
                  {wishlistCount > 0 && (
                    <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <Link 
                  href="/cart" 
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart size={18} className="text-blue-600" />
                    <span>Cart</span>
                  </div>
                  {cartCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link 
                  href="/orders" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <PackageIcon size={18} className="text-gray-600" />
                  <span>My Orders</span>
                </Link>
                {isSeller && (
                  <Link 
                    href="/store" 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">Seller</span>
                    <span>Dashboard</span>
                  </Link>
                )}
              </div>

              {/* Support Section */}
              <div className="mt-auto pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-4">Support</p>
                <Link 
                  href="/faq" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
                <Link 
                  href="/support" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Support
                </Link>
                <Link 
                  href="/terms" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Terms & Conditions
                </Link>
                <Link 
                  href="/privacy-policy" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Privacy Policy
                </Link>
                <Link 
                  href="/return-policy" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Return Policy
                </Link>
                {firebaseUser && (
                  <button
                    className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 rounded-lg transition text-red-600 font-medium mt-4"
                    onClick={async () => {
                      await auth.signOut();
                      setMobileMenuOpen(false);
                      toast.success('Signed out successfully');
                      window.location.reload();
                    }}
                  >
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          </div>
        )}


      {/* Sign In Modal (always at Navbar root) */}
      {!firebaseUser && <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />}
    </div>
  </nav>
    </>
  );
};

export default Navbar;
