import { useState, useEffect } from 'react'
import { Plus, AlertCircle, CheckCircle } from 'lucide-react'

interface Store {
  id: number
  name: string
  domain: string
  isActive: boolean
}

interface AddProductFormProps {
  onSuccess?: () => void
}

export function AddProductForm({ onSuccess }: AddProductFormProps) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [selector, setSelector] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [stores, setStores] = useState<Store[]>([])

  useEffect(() => {
    // Fetch supported stores
    fetch('/api/stores/supported')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStores(data.stores)
        }
      })
      .catch(err => console.error('Failed to fetch stores:', err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || undefined,
          targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
          selector: selector.trim() || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Product added successfully!' })
        // Reset form
        setUrl('')
        setName('')
        setTargetPrice('')
        setSelector('')
        
        // Navigate to products tab after a brief delay
        setTimeout(() => {
          onSuccess?.()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add product' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to connect to API' })
      console.error('Error adding product:', err)
    } finally {
      setLoading(false)
    }
  }

  const exampleUrls = [
    'https://www.amazon.com.au/dp/B08N5WRWNW',
    'https://www.ebay.com.au/itm/123456789',
    'https://www.jbhifi.com.au/products/example-product',
    'https://www.harveynorman.com.au/p/example-product',
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Add New Product</h2>
        <p className="text-gray-600">Track prices for products from any online store</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border flex items-center space-x-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={20} className="flex-shrink-0" />
          ) : (
            <AlertCircle size={20} className="flex-shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              Product URL *
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.bonmaxie.com.au/products/canvas-tote-bag"
              required
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Paste the full URL from any online store
            </p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Product Name (optional)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Custom name for this product"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Leave blank to automatically detect from the page
            </p>
          </div>

          <div>
            <label htmlFor="targetPrice" className="block text-sm font-medium text-gray-700 mb-2">
              Target Price (optional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">$</span>
              </div>
              <input
                type="number"
                id="targetPrice"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="99.99"
                min="0"
                step="0.01"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-7"
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Get notified when price drops to or below this amount
            </p>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="selector" className="block text-sm font-medium text-gray-700">
                Custom CSS Selector
              </label>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Advanced</span>
            </div>
            <input
              type="text"
              id="selector"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder=".price, .current-price"
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Override default price selector for this product
            </p>
          </div>

          <div className="flex justify-center pt-6 border-t">
            <button 
              type="submit" 
              disabled={loading || !url.trim()}
              className={`inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-xl border-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${loading ? 'opacity-50 cursor-not-allowed transform-none' : ''}`}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Adding...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Plus size={16} />
                  <span>Add Product</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Popular Stores</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stores.map((store) => (
            <div key={store.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="font-medium text-gray-900">{store.name}</div>
              <div className="text-sm text-gray-500">{store.domain}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p><strong>New!</strong> We now support any online store, not just the ones listed above. Try any product URL!</p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Example URLs</h3>
        <div className="space-y-2">
          {exampleUrls.map((exampleUrl, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setUrl(exampleUrl)}
              className="w-full text-left p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm font-mono text-primary-600"
            >
              {exampleUrl}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}