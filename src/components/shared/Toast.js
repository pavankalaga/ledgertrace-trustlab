import React, { useEffect } from 'react';

const Toast = ({ message, isVisible, onHide }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => onHide(), 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide]);

  return <div className={`toast ${isVisible ? 'show' : ''}`}>{message}</div>;
};

export default Toast;
