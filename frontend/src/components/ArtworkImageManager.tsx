import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { 
  getArtworkImages, 
  addArtworkImage, 
  deleteArtworkImage,
  updateArtworkImage,
  ArtworkImage 
} from '../api/images';
import { Button, Form, Card, Alert, Spinner } from 'react-bootstrap';
import './ArtworkImageManager.css';

interface ArtworkImageManagerProps {
  artworkId: number;
  onImagesUpdated?: (images: ArtworkImage[]) => void;
}

const ArtworkImageManager: React.FC<ArtworkImageManagerProps> = ({ artworkId, onImagesUpdated }) => {
  const token = useSelector((state: RootState) => state.auth.token);
  const [images, setImages] = useState<ArtworkImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadImages = async () => {
    setLoading(true);
    try {
      console.log('Loading images for artwork:', artworkId);
      const data = await getArtworkImages(artworkId);
      console.log('Loaded images:', data);
      setImages(data);
      onImagesUpdated?.(data);
    } catch (err: any) {
      console.error('Error loading images:', err);
      setError(err.message || 'Chyba při načítání obrázků');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [artworkId]);

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !imageFile) return;

    setUploading(true);
    setError(null);
    try {
      // Upload file and get URL
      const formData = new FormData();
      formData.append('file', imageFile);
      console.log('Uploading image...');
      const uploadRes = await fetch(`/api/upload/${artworkId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const { imageUrl } = await uploadRes.json();
      console.log('Image uploaded, URL:', imageUrl);
      
      // Add image to artwork
      const addedImage = await addArtworkImage(token, artworkId, imageUrl, isPrimary);
      console.log('Image added to artwork:', addedImage);
      
      setImageFile(null);
      setIsPrimary(false);
      await loadImages();
      console.log('Images reloaded');
    } catch (err: any) {
      console.error('Error adding image:', err);
      setError(err.message || 'Chyba při přidání obrázku');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!token || !window.confirm('Opravdu chcete smazat tento obrázek?')) return;

    try {
      await deleteArtworkImage(token, artworkId, imageId);
      await loadImages();
    } catch (err: any) {
      setError(err.message || 'Chyba při mazání obrázku');
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    if (!token) return;

    try {
      await updateArtworkImage(token, artworkId, imageId, true);
      await loadImages();
    } catch (err: any) {
      setError(err.message || 'Chyba při nastavení primárního obrázku');
    }
  };

  return (
    <div className="artwork-image-manager">
      <h5>Správa Obrázků</h5>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {/* Form for adding new image */}
      <Card className="mb-4">
        <Card.Body>
          <h6>Přidat nový obrázek</h6>
          <Form onSubmit={handleAddImage}>
            <Form.Group className="mb-3">
              <Form.Label>Vybrat obrázek:</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <label className="btn btn-outline-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                  Vybrat soubor
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e: any) => setImageFile((e.target as HTMLInputElement).files?.[0] || null)}
                    required
                    style={{ display: 'none' }}
                  />
                </label>
                {imageFile && <span className="text-muted small">{imageFile.name}</span>}
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Nastavit jako hlavní obrázek"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
            </Form.Group>
            <Button variant="primary" type="submit" size="sm" disabled={uploading || !imageFile}>
              {uploading ? <Spinner animation="border" size="sm" /> : 'Nahrát obrázek'}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {/* List of existing images */}
      {loading && <Spinner animation="border" />}

      {images.length === 0 && !loading && (
        <Alert variant="info">Žádné obrázky nejsou přiřazeny k tomuto artwork.</Alert>
      )}

      <div className="images-grid">
        {images.map((image) => (
          <Card key={image.id} className="image-card">
            <Card.Img 
              variant="top" 
              src={image.imageUrl} 
              alt="Artwork" 
              className="image-thumbnail"
            />
            <Card.Body className="p-2">
              {image.isPrimary && (
                <div className="badge badge-success mb-2">Hlavní obrázek</div>
              )}
              <div className="image-actions">
                {!image.isPrimary && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleSetPrimary(image.id)}
                    className="me-1"
                  >
                    Nastavit jako hlavní
                  </Button>
                )}
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDeleteImage(image.id)}
                >
                  Smazat
                </Button>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ArtworkImageManager;
