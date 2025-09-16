import { NextRequest, NextResponse } from 'next/server';
import vCardsJS from 'vcards-js';

export interface VCardData {
  firstName?: string;
  lastName?: string;
  organization?: string;
  title?: string;
  email?: string;
  workPhone?: string;
  cellPhone?: string;
  url?: string;
  workAddress?: {
    street?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    countryRegion?: string;
  };
  socialUrls?: {
    facebook?: string;
    linkedIn?: string;
    twitter?: string;
    instagram?: string;
  };
  photo?: string;
  note?: string;
}

export async function POST(request: NextRequest) {
  try {
    // ミドルウェアで認証チェック済み

    const data: VCardData = await request.json();

    const vCard = vCardsJS();

    if (data.firstName) vCard.firstName = data.firstName;
    if (data.lastName) vCard.lastName = data.lastName;
    if (data.organization) vCard.organization = data.organization;
    if (data.title) vCard.title = data.title;
    if (data.email) vCard.email = data.email;
    if (data.workPhone) vCard.workPhone = data.workPhone;
    if (data.cellPhone) vCard.cellPhone = data.cellPhone;
    if (data.url) vCard.url = data.url;

    if (data.workAddress) {
      vCard.workAddress.street = data.workAddress.street || '';
      vCard.workAddress.city = data.workAddress.city || '';
      vCard.workAddress.stateProvince = data.workAddress.stateProvince || '';
      vCard.workAddress.postalCode = data.workAddress.postalCode || '';
      vCard.workAddress.countryRegion = data.workAddress.countryRegion || '';
    }

    if (data.socialUrls) {
      if (data.socialUrls.facebook) vCard.socialUrls.facebook = data.socialUrls.facebook;
      if (data.socialUrls.linkedIn) vCard.socialUrls.linkedIn = data.socialUrls.linkedIn;
      if (data.socialUrls.twitter) vCard.socialUrls.twitter = data.socialUrls.twitter;
      if (data.socialUrls.instagram) vCard.socialUrls.instagram = data.socialUrls.instagram;
    }

    if (data.photo) {
      vCard.photo.embedFromString(data.photo, 'image/jpeg');
    }

    if (data.note) vCard.note = data.note;

    vCard.version = '3.0';

    const vcardString = vCard.getFormattedString();

    return new NextResponse(vcardString, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard;charset=utf-8',
        'Content-Disposition': `attachment; filename="${data.firstName || 'contact'}_${data.lastName || 'card'}.vcf"`,
      },
    });

  } catch (error) {
    console.error('VCard generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate VCard' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/profiles/${username}`);
    const profile = await response.json();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const vCard = vCardsJS();

    const nameParts = profile.name?.split(' ') || [];
    vCard.firstName = nameParts[0] || '';
    vCard.lastName = nameParts.slice(1).join(' ') || '';
    vCard.organization = profile.company || '';
    vCard.title = profile.position || '';
    vCard.email = profile.email || '';
    vCard.workPhone = profile.phone || '';
    vCard.cellPhone = profile.mobile || '';
    vCard.url = profile.website || '';

    if (profile.address) {
      vCard.workAddress.street = profile.address;
      vCard.workAddress.postalCode = profile.postalCode || '';
    }

    if (profile.links && profile.links.length > 0) {
      profile.links.forEach((link: any) => {
        if (link.url.includes('linkedin')) {
          vCard.socialUrls.linkedIn = link.url;
        } else if (link.url.includes('twitter') || link.url.includes('x.com')) {
          vCard.socialUrls.twitter = link.url;
        } else if (link.url.includes('facebook')) {
          vCard.socialUrls.facebook = link.url;
        } else if (link.url.includes('instagram')) {
          vCard.socialUrls.instagram = link.url;
        }
      });
    }

    if (profile.bio) {
      vCard.note = profile.bio;
    }

    vCard.version = '3.0';

    const vcardString = vCard.getFormattedString();

    return new NextResponse(vcardString, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard;charset=utf-8',
        'Content-Disposition': `attachment; filename="${username}.vcf"`,
      },
    });

  } catch (error) {
    console.error('VCard generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate VCard' },
      { status: 500 }
    );
  }
}