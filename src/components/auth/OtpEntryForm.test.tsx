import { fireEvent, render, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';

import { OtpEntryForm, type VerifyOutcome } from './OtpEntryForm';

const ok = (): Promise<VerifyOutcome> => Promise.resolve({ status: 'ok' });
const wrong = (message?: string): Promise<VerifyOutcome> => Promise.resolve({ status: 'wrong', message });

// Same RNTL v14 notes as PhoneEntryForm.test.tsx: render()/fireEvent.* are
// async by default and must be awaited. `onSubmit` is a real async network
// call now (qode-oneview's POST /api/auth/verify, see login.tsx and
// src/lib/api.ts), so every mock here returns a Promise, matching that.
describe('OtpEntryForm', () => {
  it('renders the masked phone, the 6-digit input and the Sign-in button', async () => {
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(ok)} onChangeNumber={jest.fn()} />);
    expect(screen.getByText(/98XXXXXX10/)).toBeTruthy();
    expect(screen.getByPlaceholderText('······')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('disables Sign in under 6 digits', async () => {
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(ok)} onChangeNumber={jest.fn()} />);
    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '12345');
    expect(button).toBeDisabled();
  });

  it('auto-submits on the 6th digit without a separate button press', async () => {
    const onSubmit = jest.fn(ok);
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '123456');
    expect(onSubmit).toHaveBeenCalledWith('123456');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error for a wrong code and clears the field', async () => {
    const onSubmit = jest.fn(() => wrong());
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '000001');
    expect(screen.getByText(/did not match/i)).toBeTruthy();
    expect(screen.getByPlaceholderText('······').props.value).toBe('');
  });

  it('shows the server\'s own error message when one is given', async () => {
    const onSubmit = jest.fn(() => wrong('Too many wrong codes. Ask for a new one.'));
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '000001');
    expect(screen.getByText('Too many wrong codes. Ask for a new one.')).toBeTruthy();
  });

  it('clears the error once the reader starts typing again', async () => {
    const onSubmit = jest.fn(() => wrong());
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '000001');
    expect(screen.getByText(/did not match/i)).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '1');
    expect(screen.queryByText(/did not match/i)).toBeNull();
  });

  it('does not call onSubmit a second time for a correct code once already accepted', async () => {
    // Guards against the 6th-digit auto-submit firing twice if a future
    // edit re-triggers handleChange with the same 6 digits.
    const onSubmit = jest.fn(ok);
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText('······'), '123456');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the resend cooldown text', async () => {
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(ok)} onChangeNumber={jest.fn()} />);
    expect(screen.getByText(/you can ask for another in 30s/i)).toBeTruthy();
  });

  it('calls onChangeNumber when "Change number" is pressed', async () => {
    const onChangeNumber = jest.fn();
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(ok)} onChangeNumber={onChangeNumber} />);

    await fireEvent.press(screen.getByText('Change number'));
    expect(onChangeNumber).toHaveBeenCalledTimes(1);
  });
});
