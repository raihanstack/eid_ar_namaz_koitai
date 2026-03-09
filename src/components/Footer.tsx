import React from 'react';
import { FaFacebookF, FaGithub } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 py-6 mt-10 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">

        {/* Left Section */}
        <div className="text-center md:text-left">
          <h2 className="text-lg font-bold">ঈদের নামাজ কয়টায়</h2>
          <p className="text-sm mt-1">সব মসজিদের তথ্য, নামাজের সময়সূচী এবং ভোট সিস্টেম পাবলিক।</p>
        </div>

        {/* Right Section */}
        <div className="flex flex-col items-center md:items-end gap-2 text-sm">
          <p>&copy; {new Date().getFullYear()} সকল অধিকার সংরক্ষিত</p>
          <p>ডেভেলপার: raihanstack</p>

          {/* Social Icons */}
          <div className="flex gap-3 mt-2">
            <a href="https://facebook.com/raihanstack" aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
              <FaFacebookF size={20} />
            </a>
            <a href="https://github.com/raihanstack" aria-label="GitHub" target="_blank" rel="noopener noreferrer" className="hover:text-gray-800 transition-colors">
              <FaGithub size={20} />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;