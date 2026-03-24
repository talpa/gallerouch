import React from 'react';
import { useSearchParams } from 'react-router-dom';

const DataDeletionPage: React.FC = () => {
  const [params] = useSearchParams();
  const code = params.get('code');

  return (
    <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1>Smazání uživatelských dat</h1>
      {code && (
        <p>
          Vaše žádost o smazání dat byla přijata. Potvrzovací kód: <strong>{code}</strong>
        </p>
      )}
      <p>
        Pokud si přejete smazat veškerá vaše osobní data uložená v aplikaci Gallerouch, postupujte
        takto:
      </p>
      <ol>
        <li>Přihlaste se do svého účtu na této stránce.</li>
        <li>Přejděte do nastavení účtu.</li>
        <li>Klikněte na „Smazat účet".</li>
      </ol>
      <p>
        Případně nás kontaktujte prostřednictvím kontaktních údajů uvedených na webu. Vaše data
        smažeme do 30 dnů od přijetí žádosti.
      </p>
      <p>Po smazání budou trvale odstraněny veškeré osobní údaje: jméno, e-mail a profil.</p>
    </div>
  );
};

export default DataDeletionPage;
