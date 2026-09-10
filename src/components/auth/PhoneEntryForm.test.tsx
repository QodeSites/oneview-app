import { fireEvent, render, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';

import { PhoneEntryForm } from './PhoneEntryForm';

// Mirrors qode-oneview's own normalisePhone rule (src/lib/otp.ts): 10
// digits, must start with 6-9 (valid Indian mobile prefixes) after
// stripping non-digits. Client-side validation should reject the exact
// same inputs the backend would, not a looser or stricter rule.
//
// RNTL v14: render() and fireEvent.* are async by default and must be
// awaited before the updated tree is queryable — see callstack's v14
// migration guide.
describe('PhoneEntryForm', () => {
  it('renders a phone input and a submit button', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText(/10-digit mobile number/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /send code/i })).toBeTruthy();
  });

  it('disables submit for an empty or incomplete number', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    const button = screen.getByRole('button', { name: /send code/i });
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText(/10-digit mobile number/i), '98765');
    expect(button).toBeDisabled();
  });

  it('disables submit for a 10-digit number with an invalid prefix', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(/10-digit mobile number/i), '1234567890');
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('enables submit for a valid 10-digit number and calls onSubmit with it', async () => {
    const onSubmit = jest.fn();
    await render(<PhoneEntryForm onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByPlaceholderText(/10-digit mobile number/i), '9876543210');
    const button = screen.getByRole('button', { name: /send code/i });
    expect(button).toBeEnabled();

    await fireEvent.press(button);
    expect(onSubmit).toHaveBeenCalledWith('9876543210');
  });

  it('accepts a number with formatting characters, normalizing before submit', async () => {
    const onSubmit = jest.fn();
    await render(<PhoneEntryForm onSubmit={onSubmit} />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(/10-digit mobile number/i),
      '+91 98765-43210',
    );
    await fireEvent.press(screen.getByRole('button', { name: /send code/i }));
    expect(onSubmit).toHaveBeenCalledWith('9876543210');
  });

  it('shows an inline error for an invalid, non-empty number', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(/10-digit mobile number/i), '123');
    expect(screen.getByText(/enter a 10-digit indian mobile number/i)).toBeTruthy();
  });

  it('shows no error while the field is empty', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.queryByText(/enter a 10-digit indian mobile number/i)).toBeNull();
  });
});
