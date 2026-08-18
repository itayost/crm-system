import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login on unauthorized. Resolved against the current
      // origin: a bare relative string here is ambiguous enough that Next
      // lints against it.
      window.location.href = new URL('/login', window.location.origin).toString()
    }
    return Promise.reject(error)
  }
)

export default api