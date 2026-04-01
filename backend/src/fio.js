/**
 * Fio Bank API integration for checking incoming payments
 * Documentation: https://www.fio.cz/bank-services/api-bankovnictvi
 * 
 * Requires Node.js 18+ (uses built-in fetch API)
 * For older Node.js versions, install: npm install node-fetch@2
 */

class FioApi {
  constructor(token, accountNumber = null) {
    // Token from .env may accidentally include whitespace or wrapping quotes.
    this.token = typeof token === 'string'
      ? token.trim().replace(/^['\"]|['\"]$/g, '')
      : token;
    this.accountNumber = accountNumber; // e.g., "2400078999/2010"

    const configuredBaseUrl = (process.env.FIO_API_BASE_URL || '').trim();
    this.baseUrl = this.normalizeBaseUrl(configuredBaseUrl || 'https://fioapi.fio.cz/v1/rest');
  }

  normalizeBaseUrl(baseUrl) {
    const normalized = baseUrl.replace(/\/+$/, '');

    // Fio legacy endpoints may return HTML homepage instead of API JSON.
    if (
      normalized.includes('www.fio.cz/ib_api/rest')
      || normalized.includes('api.fio.cz/ib_api/rest')
      || normalized.includes('www.fio.cz/iss/api/rest')
    ) {
      return 'https://fioapi.fio.cz/v1/rest';
    }

    return normalized;
  }

  /**
   * Check if Fio API is configured
   */
  isConfigured() {
    return !!this.token;
  }

  /**
   * Get account balance and last transactions
   * @param {string} dateFrom - Format: YYYY-MM-DD
   * @param {string} dateTo - Format: YYYY-MM-DD
   * @returns {Promise<Array>} List of transactions
   */
  async getTransactions(dateFrom, dateTo) {
    if (!this.isConfigured()) {
      throw new Error('Fio API token not configured. Set FIO_API_TOKEN in .env');
    }

    try {
      const encodedToken = encodeURIComponent(this.token);
      const encodedFrom = encodeURIComponent(dateFrom);
      const encodedTo = encodeURIComponent(dateTo);
      const url = `${this.baseUrl}/periods/${encodedToken}/${encodedFrom}/${encodedTo}/transactions.json`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const responseText = await response.text();

      if (!response.ok) {
        const preview = responseText.slice(0, 200).replace(/\s+/g, ' ').trim();
        throw new Error(
          `Fio API error: ${response.status} ${response.statusText}; content-type=${contentType || 'unknown'}; body=${preview}`
        );
      }

      if (!contentType.includes('application/json')) {
        const preview = responseText.slice(0, 200).replace(/\s+/g, ' ').trim();
        throw new Error(
          `Fio API error: Expected JSON but received content-type=${contentType || 'unknown'}; url=${url}; body=${preview}; possible causes: invalid/expired token or wrong endpoint URL`
        );
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        const preview = responseText.slice(0, 200).replace(/\s+/g, ' ').trim();
        throw new Error(`Fio API error: Invalid JSON response; body=${preview}`);
      }
      
      // Return transactions array from accountStatement
      if (data.accountStatement && data.accountStatement.transactionList) {
        return data.accountStatement.transactionList.transaction || [];
      }
      
      return [];
    } catch (error) {
      console.error('Fio API error:', error.message);
      throw error;
    }
  }

  /**
   * Get last transactions by date
   * @param {Date} sinceDate - Get transactions since this date
   * @returns {Promise<Array>} List of transactions
   */
  async getRecentTransactions(sinceDate = null) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Default: get transactions from last 30 days
    if (!sinceDate) {
      sinceDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const fromStr = sinceDate.toISOString().split('T')[0]; // YYYY-MM-DD

    return this.getTransactions(fromStr, todayStr);
  }

  /**
   * Parse Fio transaction to extract variable symbol and amount
   * Variable symbol is stored in the reference/message field
   * @param {Object} transaction
   * @returns {Object} Parsed transaction data
   */
  parseTransaction(transaction) {
    // Transaction structure from Fio:
    // {
    //   id: number,
    //   postedDate: "YYYY-MM-DD",
    //   amount: number (positive for incoming),
    //   currency: "CZK",
    //   detail: [
    //     { id: 4, value: "variable symbol" },
    //     { id: 8, value: "description/message" },
    //     { id: 7, value: "bank code" },
    //     ...
    //   ]
    // }

    let variableSymbol = null;
    let constantSymbol = null;
    let description = null;
    let senderName = null;
    let senderAccount = null;

    if (transaction.detail && Array.isArray(transaction.detail)) {
      transaction.detail.forEach((detail) => {
        // 4 = variable symbol
        if (detail.id === 4 && detail.value) {
          variableSymbol = detail.value.trim();
        }
        // 8 = user description/message
        if (detail.id === 8 && detail.value) {
          description = detail.value.trim();
        }
        // 3 = constant symbol
        if (detail.id === 3 && detail.value) {
          constantSymbol = detail.value.trim();
        }
        // 10 = sender name
        if (detail.id === 10 && detail.value) {
          senderName = detail.value.trim();
        }
        // 2 = sender account with bank code
        if (detail.id === 2 && detail.value) {
          senderAccount = detail.value.trim();
        }
      });
    }

    return {
      transactionId: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      date: transaction.postedDate,
      variableSymbol,
      constantSymbol,
      description,
      senderName,
      senderAccount,
    };
  }

  /**
   * Filter incoming payments (positive amount)
   * @param {Array} transactions
   * @returns {Array} Incoming transactions only
   */
  filterIncomingPayments(transactions) {
    return transactions.filter((tx) => tx.amount > 0);
  }

  /**
   * Find transactions with variable symbol
   * @param {Array} transactions
   * @returns {Array} Transactions with variable symbol set
   */
  filterTransactionsWithSymbol(transactions) {
    return transactions.filter((tx) => tx.variableSymbol && tx.variableSymbol.length > 0);
  }
}

export default FioApi;
