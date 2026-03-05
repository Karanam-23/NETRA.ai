import axios from 'axios'
import { auth } from '@/lib/firebase'

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
})

// Attach Firebase JWT to every outgoing request
apiClient.interceptors.request.use(
    async (config) => {
        const user = auth.currentUser
        if (user) {
            const token = await user.getIdToken()
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Global response error handler
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid — force sign out
            auth.signOut()
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default apiClient
