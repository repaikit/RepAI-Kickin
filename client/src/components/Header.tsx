import React from "react";
import { Link } from "wouter";

export default function Header() {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9.4l1.93 1.93c.39.39 1.02.39 1.41 0L17 8.75l-1.38-1.38-3.07 3.07L9.8 7.68 8.42 9.06l1.58 1.54z" />
          </svg>
          <h1 className="text-2xl font-bold text-slate-800">Kick'in</h1>
        </div>
        
        <nav className="hidden md:flex space-x-6">
          <Link href="/" className="text-primary font-medium">Dashboard</Link>
          <Link href="/matches" className="text-slate-600 hover:text-primary transition-colors">Matches</Link>
          <Link href="/players" className="text-slate-600 hover:text-primary transition-colors">Players</Link>
          <Link href="/statistics" className="text-slate-600 hover:text-primary transition-colors">Statistics</Link>
        </nav>
        
        <div className="flex items-center space-x-4">
          <button className="text-slate-600 hover:text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          
          <div className="relative">
            <img 
              src="https://pixabay.com/get/g5474e7a3487f91a61bdf8a54d2c2f2092b3adbe6f8ed91651d0070a4e3f7c1d0960a5a2904805cd25ecf4f2d92aeb8ca47042c7e6f5676a8357fed3e2806891c_1280.jpg" 
              alt="Profile" 
              className="w-10 h-10 rounded-full object-cover border-2 border-primary"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-white"></span>
          </div>
        </div>
        
        <button className="md:hidden text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </div>
    </header>
  );
}
