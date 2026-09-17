import { fireEvent, render, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';

import { PhoneEntryForm } from './PhoneEntryForm';

// Indian mobile numbers only, with no country code shown: 10 digits,
// starting 6-9 (the backend's own rule), submitted with "+91" attached.
//
// RNTL v14: render() and fireEvent.* are async by default and must be
// awaited before the updated tree is queryable — see callstack's v14
// migration guide.
describe('PhoneEntryForm', () => {
  const PLACEHOLDER = /^phone number$/i;

  it('renders just a phone input and a submit button, with no country code picker', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByText('+91')).toBeNull();
    expect(screen.queryByRole('button', { name: /country code/i })).toBeNull();
    expect(screen.getByRole('button', { name: /send code/i })).toBeTruthy();
  });

  it('disables submit for an empty number', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('disables submit for a 6-digit number', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '932404');
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('caps the field at 10 digits', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText(PLACEHOLDER).props.maxLength).toBe(10);
  });

  it('disables submit for a 10-digit number with an invalid Indian leading digit', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '1234567890');
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('enables submit for a valid 10-digit Indian number and calls onSubmit with +91 attached', async () => {
    const onSubmit = jest.fn();
    await render(<PhoneEntryForm onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '9876543210');
    const button = screen.getByRole('button', { name: /send code/i });
    expect(button).toBeEnabled();

    await fireEvent.press(button);
    expect(onSubmit).toHaveBeenCalledWith('+919876543210');
  });

  it('strips formatting characters from the national number before submit', async () => {
    const onSubmit = jest.fn();
    await render(<PhoneEntryForm onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '98765-43210');
    await fireEvent.press(screen.getByRole('button', { name: /send code/i }));
    expect(onSubmit).toHaveBeenCalledWith('+919876543210');
  });

  it('shows an inline error naming the expected length for an invalid, non-empty number', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '123');
    expect(screen.getByText(/enter a valid 10-digit phone number/i)).toBeTruthy();
  });

  it('shows no error while the field is empty', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.queryByText(/enter a valid.*phone number/i)).toBeNull();
  });
});
