import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'

let debounceTimer = null

export const uploadCart = createAsyncThunk('cart/uploadCart', 
    async ({ getToken }, thunkAPI) => {
        try {
            const { cartItems } = thunkAPI.getState().cart;
            const token = await getToken();
            await axios.post('/api/cart', {cart: cartItems}, { headers: { Authorization: `Bearer ${token}` } })
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response.data)
        }
    }
)

export const fetchCart = createAsyncThunk('cart/fetchCart', 
    async ({ getToken }, thunkAPI) => {
        try {
            const token = await getToken()
            const { data } = await axios.get('/api/cart', {headers: { Authorization: `Bearer ${token}` }})
            return data
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response.data)
        }
    }
)


const cartSlice = createSlice({
    name: 'cart',
    initialState: (() => {
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem('cartState'));
        } catch {}
        return saved || { total: 0, cartItems: {} };
    })(),
    reducers: {
        rehydrateCart: (state) => {
            let saved = null;
            try {
                saved = JSON.parse(localStorage.getItem('cartState'));
            } catch {}
            if (saved) {
                state.cartItems = saved.cartItems || {};
                state.total = saved.total || 0;
            }
        },
        addToCart: (state, action) => {
            const { productId } = action.payload
            if (state.cartItems[productId]) {
                state.cartItems[productId]++
            } else {
                state.cartItems[productId] = 1
            }
            state.total += 1
            localStorage.setItem('cartState', JSON.stringify(state));
        },
        removeFromCart: (state, action) => {
            const { productId } = action.payload
            if (state.cartItems[productId]) {
                state.cartItems[productId]--
                if (state.cartItems[productId] === 0) {
                    delete state.cartItems[productId]
                }
            }
            state.total -= 1
            localStorage.setItem('cartState', JSON.stringify(state));
        },
        deleteItemFromCart: (state, action) => {
            const { productId } = action.payload
            state.total -= state.cartItems[productId] ? state.cartItems[productId] : 0
            delete state.cartItems[productId]
            localStorage.setItem('cartState', JSON.stringify(state));
        },
        clearCart: (state) => {
            state.cartItems = {}
            state.total = 0
            localStorage.setItem('cartState', JSON.stringify(state));
        },
    },
    extraReducers: (builder)=>{
        builder.addCase(fetchCart.fulfilled, (state, action)=>{
            state.cartItems = action.payload.cart
            state.total = Object.values(action.payload.cart).reduce((acc, item)=>acc + item, 0)
        })
    }
})

export const { addToCart, removeFromCart, clearCart, deleteItemFromCart, rehydrateCart } = cartSlice.actions

export default cartSlice.reducer
