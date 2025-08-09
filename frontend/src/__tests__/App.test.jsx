import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  test('renders the main heading', () => {
    render(<App />);
    const headingElement = screen.getByText(/Digital Payment Wallet/i);
    expect(headingElement).toBeInTheDocument();
  });
});
