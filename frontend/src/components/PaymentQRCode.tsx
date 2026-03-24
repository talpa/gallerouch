import React, { useMemo } from 'react';
import QRCode from 'qrcode.react';
import { useTranslation } from 'react-i18next';

interface PaymentQRCodeProps {
  bankAccount: string;
  galleryName: string;
  price: number;
  variableSymbol: string;
  description: string;
  paymentId?: number;
  createdAt?: string;
}

/**
 * Generates Czech bank payment QR Code according to qr-platba.cz and qr-faktura.cz standards
 * Format: SPAYD (Short Payment Descriptor) extended with invoice data
 * Supported by all Czech banks: FIO, ČSOB, Česká spořitelna, KB, etc.
 * 
 * Standard specifications:
 * - QR Platba: https://qr-platba.cz/pro-vyvojare/specifikace/
 * - QR Faktura: Extended SPAYD with invoice metadata
 * 
 * SPAYD format structure:
 * SPD*1.0*ACC:{IBAN}*AM:{amount}*CC:{currency}*X-VS:{variable_symbol}*MSG:{message}*X-INV:{invoice_num}*DT:{due_date}*RN:{recipient_name}
 * 
 * All fields separated by *, key:value format
 * Basic fields (QR Platba):
 * - ACC: IBAN format (mandatory)
 * - AM: Amount with decimal point (max 2 decimal places)
 * - CC: Currency code (CZK)
 * - X-VS: Variable symbol (Czech extension)
 * - MSG: Message for recipient (max 60 chars)
 * 
 * Extended fields (QR Faktura):
 * - X-INV: Invoice number
 * - DT: Due date (format YYYYMMDD)
 * - RN: Recipient name (seller/gallery name)
 */
const PaymentQRCode: React.FC<PaymentQRCodeProps> = ({
  bankAccount,
  galleryName,
  price,
  variableSymbol,
  description,
  paymentId,
  createdAt,
}) => {
  const { t } = useTranslation();

  // Function to remove diacritics from Czech text
  const removeDiacritics = (text: string): string => {
    const diacriticsMap: { [key: string]: string } = {
      'á': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e', 'í': 'i',
      'ň': 'n', 'ó': 'o', 'ř': 'r', 'š': 's', 'ť': 't', 'ú': 'u',
      'ů': 'u', 'ý': 'y', 'ž': 'z',
      'Á': 'A', 'Č': 'C', 'Ď': 'D', 'É': 'E', 'Ě': 'E', 'Í': 'I',
      'Ň': 'N', 'Ó': 'O', 'Ř': 'R', 'Š': 'S', 'Ť': 'T', 'Ú': 'U',
      'Ů': 'U', 'Ý': 'Y', 'Ž': 'Z'
    };
    
    return text.split('').map(char => diacriticsMap[char] || char).join('');
  };

  // Generate SPAYD QR Code data with QR Faktura extensions
  const qrData = useMemo(() => {
    // Ensure price is a number
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    
    // Defensive check - ensure bankAccount exists
    if (!bankAccount) {
      console.warn('PaymentQRCode: bankAccount is missing');
      return 'ERROR: Missing bank account';
    }
    
    // Prepare IBAN - if already IBAN, use it; otherwise convert Czech format
    let iban = bankAccount;
    if (!bankAccount.startsWith('CZ')) {
      // Convert Czech format (123456789/0100) to IBAN
      const parts = bankAccount.split('/');
      if (parts.length === 2) {
        const accountNumber = parts[0].padStart(16, '0');
        const bankCode = parts[1].padStart(4, '0');
        iban = `CZ00${bankCode}${accountNumber}`;
      }
    }
    
    // Remove any spaces from IBAN
    iban = iban.replace(/\s/g, '');
    
    // Format amount with decimal point (max 2 decimal places)
    const formattedAmount = numericPrice.toFixed(2);
    
    // Remove diacritics first, then sanitize message
    // KB is very strict - only alphanumeric and spaces, max 60 chars
    const withoutDiacritics = removeDiacritics(description || 'PLATBA');
    const sanitizedMessage = withoutDiacritics
      .replace(/[^A-Z0-9 ]/gi, '')  // Only letters, numbers, spaces
      .replace(/\s+/g, ' ')          // Single spaces only
      .trim()
      .substring(0, 60)
      .toUpperCase();
    
    // Ensure message is not empty and doesn't start/end with space
    const finalMessage = (sanitizedMessage || 'PLATBA').trim();
    
    // Build SPAYD string - basic fields first
    let spaydString = `SPD*1.0*ACC:${iban}*AM:${formattedAmount}*CC:CZK*X-VS:${variableSymbol}*MSG:${finalMessage}`;
    
    // Add QR Faktura extensions if available
    if (paymentId && createdAt && galleryName) {
      // Remove diacritics and sanitize recipient name
      const withoutDiacritics = removeDiacritics(galleryName);
      const sanitizedRecipient = withoutDiacritics
        .replace(/[^A-Z0-9 ]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 35)
        .toUpperCase();
      
      // Generate invoice number from payment ID
      const invoiceNumber = `FAK${String(paymentId).padStart(6, '0')}`;
      
      // Calculate due date (14 days from creation)
      const created = new Date(createdAt);
      created.setDate(created.getDate() + 14);
      const dueDate = created.toISOString().split('T')[0].replace(/-/g, '');
      
      // Add QR Faktura extensions
      if (sanitizedRecipient) {
        spaydString += `*RN:${sanitizedRecipient}`;
      }
      if (invoiceNumber) {
        spaydString += `*X-INV:${invoiceNumber}`;
      }
      if (dueDate) {
        spaydString += `*DT:${dueDate}`;
      }
    }

    return spaydString;
  }, [bankAccount, price, variableSymbol, description, galleryName, paymentId, createdAt]);

  // Debug log
  React.useEffect(() => {
    console.log('=== QR Code Debug Info ===');
    console.log('SPAYD string:', qrData);
    console.log('Length:', qrData.length);
    console.log('Bank account input:', bankAccount);
    console.log('Price:', price);
    console.log('VS:', variableSymbol);
    console.log('Description:', description);
  }, [qrData, bankAccount, price, variableSymbol, description]);

  // Extract Czech format for display
  const displayAccount = useMemo(() => {
    if (!bankAccount) return '';
    
    if (bankAccount.startsWith('CZ')) {
      // Extract from IBAN: CZ + 2 check + 4 bank + 16 account
      const bankCode = bankAccount.substring(4, 8);
      const accountNumber = bankAccount.substring(14, 24).replace(/^0+/, ''); // Remove leading zeros
      return `${accountNumber}/${bankCode}`;
    }
    
    return bankAccount;
  }, [bankAccount]);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h5 style={{ marginBottom: '15px' }}>
        {t('payments.scanQRCode', 'Naskenujte QR kód pro zaplacení')}
      </h5>
      <div style={{ 
        display: 'inline-block', 
        padding: '10px', 
        border: '2px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#fff'
      }}>
        <QRCode 
          value={qrData} 
          size={200}
          level="M"
          includeMargin={true}
        />
      </div>
      <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
        <p style={{ marginBottom: '5px' }}>
          <strong>{t('payments.bankAccount', 'Účet')}:</strong> {displayAccount}
        </p>
        <p style={{ marginBottom: '5px' }}>
          <strong>{t('payments.amount', 'Částka')}:</strong> {(typeof price === 'string' ? parseFloat(price) : price).toFixed(2)} CZK
        </p>
        <p style={{ marginBottom: '5px' }}>
          <strong>{t('payments.variableSymbol', 'Variabilní symbol')}:</strong> {variableSymbol}
        </p>
        <p>
          <strong>{t('payments.description', 'Popis')}:</strong> {description}
        </p>
      </div>
    </div>
  );
};

export default PaymentQRCode;
