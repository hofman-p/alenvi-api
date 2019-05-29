module.exports = {
  // EVENTS
  INTERVENTION: 'intervention',
  ABSENCE: 'absence',
  UNAVAILABILITY: 'unavailability',
  INTERNAL_HOUR: 'internalHour',
  UNJUSTIFIED: 'unjustified absence',
  ILLNESS: 'illness',
  PAID_LEAVE: 'leave',
  WEDDING: 'wedding',
  BIRTH: 'birth',
  DEATH: 'death',
  get EVENT_TYPE_LIST() {
    return {
      [this.INTERNAL_HOUR]: 'Heure interne',
      [this.INTERVENTION]: 'Intervention',
      [this.ABSENCE]: 'Absence',
      [this.UNAVAILABILITY]: 'Indisponibilité',
    };
  },
  // COMPANY
  MAX_INTERNAL_HOURS_NUMBER: 9,
  // COMPANY THIRD PARTY PAYERS
  BILLING_INDIRECT: 'indirect',
  BILLING_DIRECT: 'direct',
  // CUSTOMER FUNDINGS
  MONTHLY: 'monthly',
  ONCE: 'once',
  HOURLY: 'hourly',
  FIXED: 'fixed',
  DAILY: 'daily',
  get FUNDING_NATURES() {
    return [
      { label: 'Forfaitaire', value: this.FIXED },
      { label: 'Horaire', value: this.HOURLY },
    ];
  },
  get FUNDING_FREQUENCIES() {
    return [
      { value: this.MONTHLY, label: 'Mensuelle' },
      { value: this.ONCE, label: 'Une seule fois' },
    ];
  },
  // REPETITION FREQUENCY
  NEVER: 'never',
  EVERY_DAY: 'every_day',
  EVERY_WEEK_DAY: 'every_week_day',
  EVERY_WEEK: 'every_week',
  get REPETITION_FREQUENCY_TYPE_LIST() {
    return {
      [this.NEVER]: 'Jamais',
      [this.EVERY_DAY]: 'Tous les jours',
      [this.EVERY_WEEK_DAY]: 'Du lundi au vendredi',
      [this.EVERY_WEEK]: 'Une fois par semaine'
    };
  },
  CUSTOMER_CONTRACT: 'contract_with_customer',
  COMPANY_CONTRACT: 'contract_with_company',
  get CONTRACT_TYPES() {
    return [
      { label: 'Prestataire', value: this.COMPANY_CONTRACT },
      { label: 'Mandataire', value: this.CUSTOMER_CONTRACT },
    ];
  },
  TWO_WEEKS: 'two_weeks',
  MONTH: 'month',
  // PAYMENT
  PAYMENT: 'payment',
  REFUND: 'refund',
  WITHDRAWAL: 'withdrawal',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  CESU: 'cesu',
  get PAYMENT_TYPES() {
    return [this.WITHDRAWAL, this.BANK_TRANSFER, this.CHECK, this.CESU];
  },
  // CANCELLATION OPTIONS
  INVOICED_AND_PAYED: 'invoiced_and_payed',
  INVOICED_AND_NOT_PAYED: 'invoiced_and_not_payed',
  CUSTOMER_INITIATIVE: 'customer_initiative',
  AUXILIARY_INITIATIVE: 'auxiliary_initiative',
  get CANCELLATION_CONDITION_LIST() {
    return {
      [this.INVOICED_AND_PAYED]: 'Facturée & payée',
      [this.INVOICED_AND_NOT_PAYED]: 'Facturée & non payée',
    };
  },
  get CANCELLATION_REASON_LIST() {
    return {
      [this.CUSTOMER_INITIATIVE]: 'Initiative du client',
      [this.AUXILIARY_INITIATIVE]: 'Initiative du de l\'intervenant',
    };
  },
  // ROLE
  AUXILIARY: 'auxiliary',
  HELPER: 'helper',
  COACH: 'coach',
  TECH: 'tech',
  ADMIN: 'admin',
  PLANNING_REFERENT: 'planningReferent',
  // EXPORTS
  SERVICE: 'service',
  CUSTOMER: 'customer',
  SUBSCRIPTION: 'subscription',
  FUNDING: 'funding',
  DAYS_INDEX: {
    0: 'Lundi',
    1: 'Mardi',
    2: 'Mercredi',
    3: 'Jeudi',
    4: 'Vendredi',
    5: 'Samedi',
    6: 'Dimanche',
    7: 'Jours fériés'
  },
  // EXPORTS HISTORY
  WORKING_EVENT: 'working_event', // intervention or internal hours
  BILL: 'bill',
  // SERVICE
  get SERVICE_NATURES() {
    return this.FUNDING_NATURES;
  },
  // TRANSPORT
  PUBLIC_TRANSPORT: 'public',
  PRIVATE_TRANSPORT: 'private',
  TRANSIT: 'transit',
  DRIVING: 'driving',
};
