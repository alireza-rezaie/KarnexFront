import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()

  // Check if current route needs sidebar
  const noSidebarRoutes = ['/login', '/register', '/otp', '/onboarding']
  const isPublicPage = ['/', '/pricing'].some(path => location.pathname === path)
  const showPublicTopBar = location.pathname === '/pricing'
  const showSidebar = !noSidebarRoutes.includes(location.pathname) && !isPublicPage

  return (
    <div className="min-h-screen bg-background">
      {/* TopBar for public pages */}
      {showPublicTopBar && <TopBar />}
      
      <div className="flex min-w-0">
        {/* Sidebar for app pages */}
        {showSidebar && (
          <Sidebar 
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <main 
          className={`min-h-screen min-w-0 flex-1 overflow-x-clip transition-all duration-300 ${
            showSidebar 
              ? 'md:mr-[72px]'
              : ''
          }`}
        >
          {/* TopBar for app pages */}
          {showSidebar && (
            <div className="sticky top-0 z-40">
              <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />
            </div>
          )}
          
          <div className="p-3 sm:p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
