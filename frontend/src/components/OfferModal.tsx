import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { createOffer } from '../api/offers';
import '../styles/OfferModal.css';

interface OfferModalProps {
  show: boolean;
  artworkId: number;
  artworkTitle: string;
  onClose: () => void;
  onSuccess: () => void;
  token?: string | null;
}

export const OfferModal: React.FC<OfferModalProps> = ({
  show,
  artworkId,
  artworkTitle,
  onClose,
  onSuccess,
  token,
}) => {
  const { t } = useTranslation();
  const [offeredPrice, setOfferedPrice] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (offeredPrice === '' || offeredPrice === 0) {
      setError(t('offers.priceRequired'));
      return;
    }

    if (offeredPrice <= 0) {
      setError(t('offers.pricePositive'));
      return;
    }

    if (!token) {
      setError(t('common.error'));
      return;
    }

    setLoading(true);
    try {
      await createOffer(
        {
          artworkId,
          offeredPrice: Number(offeredPrice),
          message: message || undefined,
        },
        token
      );
      setOfferedPrice('');
      setMessage('');
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || t('offers.offerError');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>💰 {t('offers.makeOffer')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <p className="text-muted">
            {t('gallery.artworkTitle')}: <strong>{artworkTitle}</strong>
          </p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>{t('offers.offeredPrice')} (CZK)</Form.Label>
            <Form.Control
              type="number"
              step="100"
              min="0"
              value={offeredPrice}
              onChange={(e) => setOfferedPrice(e.target.value ? Number(e.target.value) : '')}
              placeholder="10 000"
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('offers.offerMessage')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('offers.offerMessage')}
              disabled={loading}
            />
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              variant="primary"
              type="submit"
              disabled={loading || !offeredPrice}
              className="flex-grow-1"
            >
              {loading ? t('common.loading') : t('offers.submitOffer')}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};
