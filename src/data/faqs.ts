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
      'Buyer and farmer arrange trucking or export freight directly between themselves, using the messaging thread attached to the order. The dashboard shows the trade’s current stage (inquiry, escrow funded, logistics scheduled, delivered) so both sides can see where things stand, but there is no logistics-partner integration or shipment tracking behind it yet — marking a stage complete is a manual step either party takes.',
  },
  {
    id: 'faq-002',
    category: 'Logistics',
    question: 'What happens if a shipment is delayed at customs?',
    answer:
      'There is no automated customs-delay detection or notification today — contact support directly and we’ll help from there. What is guaranteed by the order flow itself: escrow funds stay held regardless, and release only happens once the order is marked delivered, so a delay on its own doesn’t put your funds at risk.',
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
      'There is no in-app dispute flow yet — do not confirm receipt, and contact support with what happened and any photos you have. Funds stay in escrow and are not released to the farmer until receipt is confirmed, so raising the issue before confirming is what keeps them protected in the meantime.',
  },
  {
    id: 'faq-005',
    category: 'Quality Certification',
    question: 'How are farmer certifications verified?',
    answer:
      'Certifications a farmer lists (GlobalGAP, Fair Trade, Organic, and similar) are self-reported on their profile today — we don’t yet cross-check them against the issuing body’s registry. Ask a farmer to share their certificate directly if you need to confirm one before trading.',
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
