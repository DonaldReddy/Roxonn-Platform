import React, { useEffect } from 'react';

// Declare the Zoho types for TypeScript
declare global {
  interface Window {
    $zoho?: {
      salesiq?: {
        ready: Function;
        visible?: (state: string) => void;
        floatwindow?: {
          visible: (state: string) => void;
        };
      };
    };
  }
}

export function ChatWidget() {
  useEffect(() => {
    // Initialize Zoho SalesIQ global object
    window.$zoho = window.$zoho || {};
    window.$zoho.salesiq = window.$zoho.salesiq || { ready: function() {} };
    
    // Create and inject the script
    const script = document.createElement('script');
    script.id = 'zsiqscript';
    script.src = 'https://salesiq.zohopublic.in/widget?wc=siq5163eff5d490d9fb529572ecf11f2d81ed7bdaefa1bcd56a4cdaf079dc8cc8dd';
    script.defer = true;
    document.body.appendChild(script);

    // Cleanup function
    return () => {
      const existingScript = document.getElementById('zsiqscript');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  // No UI to render
  return null;
}
