import React from "react";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9.4l1.93 1.93c.39.39 1.02.39 1.41 0L17 8.75l-1.38-1.38-3.07 3.07L9.8 7.68 8.42 9.06l1.58 1.54z" />
            </svg>
            <span className="text-lg font-bold text-slate-800">Kick'in</span>
          </div>
          
          <div className="flex flex-wrap justify-center space-x-6">
            <Link href="/terms" className="text-slate-600 hover:text-primary text-sm my-1">Terms</Link>
            <Link href="/privacy" className="text-slate-600 hover:text-primary text-sm my-1">Privacy</Link>
            <Link href="/support" className="text-slate-600 hover:text-primary text-sm my-1">Support</Link>
            <Link href="/contact" className="text-slate-600 hover:text-primary text-sm my-1">Contact</Link>
          </div>
          
          <div className="mt-4 md:mt-0 text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Kick'in. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
