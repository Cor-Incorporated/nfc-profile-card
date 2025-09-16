declare module 'vcards-js' {
  interface VCard {
    firstName: string;
    lastName: string;
    middleName: string;
    organization: string;
    title: string;
    email: string;
    workPhone: string;
    cellPhone: string;
    homePhone: string;
    url: string;
    note: string;
    version: string;
    workAddress: {
      street: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      countryRegion: string;
    };
    homeAddress: {
      street: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      countryRegion: string;
    };
    socialUrls: {
      facebook?: string;
      linkedIn?: string;
      twitter?: string;
      instagram?: string;
    };
    photo: {
      embedFromString: (data: string, mimeType: string) => void;
      attachFromUrl: (url: string) => void;
    };
    getFormattedString: () => string;
  }

  function vCardsJS(): VCard;
  export = vCardsJS;
}