import axios from 'axios';

export interface Payment {
  id: number;
  artworkId: number;
  buyerId: number;
  sellerId: number;
  price: number;
  commission: number;
  sellerAmount: number;
  status: 'unpaid' | 'paid' | 'cancelled';
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
  createdAt: string;
  paidAt?: string;
  invoiceSentAt?: string;
  confirmedBy?: number;
  confirmedAt?: string;
  artworkTitle?: string;
  buyerEmail?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerCity?: string;
  buyerPostalCode?: string;
  sellerEmail?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerCity?: string;
  sellerPostalCode?: string;
  sellerBankAccount?: string;
  confirmerEmail?: string;
  bankAccountNumber?: string;
  galleryName?: string;
  paymentDescriptionTemplate?: string;
}

export const getPayments = async () => {
  try {
    const response = await axios.get('/api/payments');
    return response.data;
  } catch (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }
};

export const getPayment = async (paymentId: number) => {
  try {
    const response = await axios.get(`/api/payments/${paymentId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching payment:', error);
    throw error;
  }
};

export const getPaymentByArtworkId = async (artworkId: number) => {
  try {
    const response = await axios.get('/api/payments');
    const payments: Payment[] = response.data;
    // Get the most recent payment for this artwork
    const artworkPayments = payments.filter(p => p.artworkId === artworkId);
    if (artworkPayments.length === 0) {
      return null;
    }
    // Sort by createdAt descending and get the first (most recent)
    return artworkPayments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  } catch (error) {
    console.error('Error fetching payment for artwork:', error);
    throw error;
  }
};

export const createPayment = async (artworkId: number, price: number) => {
  try {
    const response = await axios.post('/api/payments', {
      artworkId,
      price,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating payment:', error);
    throw error;
  }
};

export const confirmPayment = async (
  paymentId: number,
  paymentMethod: string,
  transactionId?: string,
  notes?: string
) => {
  try {
    const response = await axios.put(`/api/payments/${paymentId}`, {
      paymentMethod,
      transactionId,
      notes,
    });
    return response.data;
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

export const sendInvoice = async (paymentId: number, invoiceNumber: string) => {
  try {
    const response = await axios.put(`/api/payments/${paymentId}/invoice`, {
      invoiceNumber,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending invoice:', error);
    throw error;
  }
};
