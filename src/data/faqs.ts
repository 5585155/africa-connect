export interface Faq {
  id: string
  category: 'Logistics' | 'Escrow Security' | 'Quality Certification' | 'Multi-Currency Settlements'
  question: string
  answer: string
}

export const FAQS: Faq[] = [
  {
    id: 'faq-001',
    category: 'Logistics',
    question: 'How is delivery coordinated for cross-border orders?',
    answer:
      'Once a trade is confirmed, our logistics partners coordinate regional trucking or export freight depending on destination. You can track shipment status from your dashboard from pickup through customs clearance.',
  },
  {
    id: 'faq-002',
    category: 'Logistics',
    question: 'What happens if a shipment is delayed at customs?',
    answer:
      'Our support team is notified automatically and works with local clearing agents. Buyers and farmers are kept updated in real time, and escrow release is paused until delivery is confirmed.',
  },
  {
    id: 'faq-003',
    category: 'Escrow Security',
    question: 'How does escrow protect both farmers and buyers?',
    answer:
      'Buyer funds are held in escrow the moment a trade is agreed. Funds are only released to the farmer once the buyer confirms receipt and quality matches the listing — protecting both sides of the trade.',
  },
  {
    id: 'faq-004',
    category: 'Escrow Security',
    question: 'What if the produce doesn’t match the listing?',
    answer:
      'Buyers can open a dispute before confirming receipt. Our team reviews photo evidence and, where needed, third-party inspection reports before releasing or refunding escrowed funds.',
  },
  {
    id: 'faq-005',
    category: 'Quality Certification',
    question: 'How are farmer certifications verified?',
    answer:
      'Certifications like GlobalGAP, Fair Trade, and Organic status are cross-checked against the issuing body’s public registry before a "Verified" badge is applied to a farmer’s profile.',
  },
  {
    id: 'faq-006',
    category: 'Quality Certification',
    question: 'Can I request a trade sample before committing?',
    answer:
      'Yes. Every listing supports a sample request. Farmers ship a small sample at buyer cost, letting you verify quality before negotiating a full order.',
  },
  {
    id: 'faq-007',
    category: 'Multi-Currency Settlements',
    question: 'Which currencies are supported for settlement?',
    answer:
      'Trades can be priced and settled in USD, EUR, KES, NGN, and GHS. Conversion rates shown at checkout are indicative — the final settlement rate locks in at the moment of trade confirmation.',
  },
  {
    id: 'faq-008',
    category: 'Multi-Currency Settlements',
    question: 'Are there fees for converting currency?',
    answer:
      'A small conversion spread is applied by our payment partner, shown transparently before you confirm any trade — never bundled silently into the unit price.',
  },
]
