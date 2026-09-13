import { fireEvent, render, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';

import { OtpEntryForm } from './OtpEntryForm';

// Same RNTL v14 notes as PhoneEntryForm.test.tsx: render()/fireEvent.* are
// async by default and must be awaited.
describe('OtpEntryForm', () => {
  it('renders the masked phone, the 6-digit input and the Sign-in button', async () => {
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(() => 'ok' as const)} onChangeNumber={jest.fn()} />);
    expect(screen.getByText(/98XXXXXX10/)).toBeTruthy();
    expect(screen.getByPlaceholderText('······')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('disables Sign in under 6 digits', async () => {
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(() => 'ok' as const)} onChangeNumber={jest.fn()} />);
    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '12345');
    expect(button).toBeDisabled();
  });

  it('auto-submits on the 6th digit without a separate button press', async () => {
    const onSubmit = jest.fn(() => 'ok' as const);
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '123456');
    expect(onSubmit).toHaveBeenCalledWith('123456');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error for a wrong code and clears the field', async () => {
    const onSubmit = jest.fn(() => 'wrong' as const);
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '000001');
    expect(screen.getByText(/doesn.t match/i)).toBeTruthy();
    expect(screen.getByPlaceholderText('······').props.value).toBe('');
  });

  it('clears the error once the reader starts typing again', async () => {
    const onSubmit = jest.fn(() => 'wrong' as const);
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '000001');
    expect(screen.getByText(/doesn.t match/i)).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('······'), '1');
    expect(screen.queryByText(/doesn.t match/i)).toBeNull();
  });

  it('does not call onSubmit a second time for a correct code once already accepted', async () => {
    // Guards against the 6th-digit auto-submit firing twice if a future
    // edit re-triggers handleChange with the same 6 digits.
    const onSubmit = jest.fn(() => 'ok' as const);
    await render(<OtpEntryForm phone="9876543210" onSubmit={onSubmit} onChangeNumber={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText('······'), '123456');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the resend cooldown text', async () => {
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(() => 'ok' as const)} onChangeNumber={jest.fn()} />);
    expect(screen.getByText(/you can ask for another in 30s/i)).toBeTruthy();
  });

  it('calls onChangeNumber when "Change number" is pressed', async () => {
    const onChangeNumber = jest.fn();
    await render(<OtpEntryForm phone="9876543210" onSubmit={jest.fn(() => 'ok' as const)} onChangeNumber={onChangeNumber} />);

    await fireEvent.press(screen.getByText('Change number'));
    expect(onChangeNumber).toHaveBeenCalledTimes(1);
  });
});
