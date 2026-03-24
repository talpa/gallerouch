// Bootstrap TableGrid component for artwork events
import React from 'react';
import Table from 'react-bootstrap/Table';
import 'bootstrap/dist/css/bootstrap.min.css';

import { ArtworkEvent } from '../api/artworks';

interface ArtworkEventsTableProps {
  events: ArtworkEvent[];
}

const ArtworkEventsTable: React.FC<ArtworkEventsTableProps> = ({ events }) => (
  <div className="container mt-4">
    <h2 className="mb-3">Artwork Events</h2>
    <Table striped bordered hover responsive>
      <thead className="table-dark">
        <tr>
          <th>#</th>
          <th>Artwork</th>
          <th>Event Type</th>
          <th>Date</th>
          <th>User</th>
        </tr>
      </thead>
      <tbody>
        {events && events.length > 0 ? (
          events.map((event: ArtworkEvent, idx: number) => (
            <tr key={event.id || idx}>
              <td>{idx + 1}</td>
              <td>{event.artworkName}</td>
              <td>{event.type}</td>
              <td>{event.date ? (isNaN(new Date(event.date).getTime()) ? '—' : new Date(event.date).toLocaleString()) : '—'}</td>
              <td>{event.userName}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={5} className="text-center">No events found.</td>
          </tr>
        )}
      </tbody>
    </Table>
  </div>
);

export default ArtworkEventsTable;
