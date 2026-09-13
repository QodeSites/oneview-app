import { fireEvent, render, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';

import { PhoneEntryForm } from './PhoneEntryForm';

// The country code is a separate picker (CountryCodePicker) defaulting to
// India (+91); this field validates the national number typed alongside
// it against THAT country's own numbering plan (phoneLengthFor in
// data/countries.ts) — India is a fixed 10 digits (plus the real 6-9
// leading-digit rule), not a flat "any length" worldwide guess.
//
// RNTL v14: render() and fireEvent.* are async by default and must be
// awaited before the updated tree is queryable — see callstack's v14
// migration guide.
describe('PhoneEntryForm', () => {
  const PLACEHOLDER = /^phone number$/i;

  it('renders a phone input, the default country code, and a submit button', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
    expect(screen.getByText('+91')).toBeTruthy();
    expect(screen.getByRole('button', { name: /send code/i })).toBeTruthy();
  });

  it('disables submit for an empty number', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('disables submit for a 6-digit number with India selected (the reported bug: it used to let 6 digits through)', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '932404');
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('disables submit for an 11-digit number with India selected (India is fixed at 10)', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '98765432101');
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('disables submit for a 10-digit number with an invalid Indian leading digit', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '1234567890');
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();
  });

  it('enables submit for a valid 10-digit Indian number and calls onSubmit with the country code attached', async () => {
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

  it('validates against the newly selected country once one is picked, not the old one', async () => {
    const onSubmit = jest.fn();
    await render(<PhoneEntryForm onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole('button', { name: /country code/i }));
    await fireEvent.changeText(screen.getByPlaceholderText(/search country or code/i), 'United States');
    await fireEvent.press(screen.getByText('United States'));

    // A 6-digit number is invalid for the US too (fixed at 10) — this
    // isn't just "India rejects it", the whole point is per-country rules.
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '415555');
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '(415) 555-0132');
    await fireEvent.press(screen.getByRole('button', { name: /send code/i }));
    expect(onSubmit).toHaveBeenCalledWith('+14155550132');
  });

  it('clears the field when the country is switched, rather than keeping a now-invalid value', async () => {
    await render(<PhoneEntryForm onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '9876543210');

    await fireEvent.press(screen.getByRole('button', { name: /country code/i }));
    await fireEvent.changeText(screen.getByPlaceholderText(/search country or code/i), 'United States');
    await fireEvent.press(screen.getByText('United States'));

    expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('');
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
