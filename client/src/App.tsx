import { useState, useEffect } from 'react'
import { ProductList } from './components/ProductList'
import { AddProductForm } from './components/AddProductForm'
import { SystemStats } from './components/SystemStats'
import { NotificationList } from './components/NotificationList'
import { Plus, BarChart3, Settings, Bell, TrendingUp } from 'lucide-react'

type TabType = 'products' | 'add' | 'stats' | 'notifications'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('products')
  const [systemStatus, setSystemStatus] = useState<any>(null)

  useEffect(() => {
    // Check system health on startup
    fetch('/api/system/health')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(err => console.error('Failed to check system health:', err))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Price Tracker</h1>
                <p className="text-sm text-gray-500">Monitor prices across stores</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${systemStatus?.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${systemStatus?.success ? 'text-green-600' : 'text-red-600'}`}>
                  {systemStatus?.success ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button 
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'products' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('products')}
            >
              <BarChart3 size={18} />
              <span>Products</span>
            </button>
            <button 
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'add' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('add')}
            >
              <Plus size={18} />
              <span>Add Product</span>
            </button>
            <button 
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'notifications' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={18} />
              <span>Notifications</span>
            </button>
            <button 
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'stats' 
                  ? 'border-primary-500 text-primary-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('stats')}
            >
              <Settings size={18} />
              <span>System</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'products' && <ProductList />}
        {activeTab === 'add' && <AddProductForm onSuccess={() => setActiveTab('products')} />}
        {activeTab === 'notifications' && <NotificationList />}
        {activeTab === 'stats' && <SystemStats />}
      </main>
    </div>
  )
}

export default App
