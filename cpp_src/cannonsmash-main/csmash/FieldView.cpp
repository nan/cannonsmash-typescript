/**
 * @file
 * @brief Implementation of FieldView class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000-2002, 2007  Kanna Yoshihiro
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

#include "ttinc.h"
#include "FieldView.h"
#include "LoadImage.h"
#include "RCFile.h"
#include "Control.h"
#include "Event.h"

extern RCFile *theRC;

/**
 * Default constructor.
 */
FieldView::FieldView() {
}

/**
 * Destructor. Do nothing.
 */
FieldView::~FieldView() {
}

/**
 * Initializer method.
 * This method should be called only once just after FieldView is created.
 * This method loads field textures to initialize texture handler.
 *
 * @return returns true if succeeds.
 */
bool
FieldView::Init() {
  int i;
// Set texture
  ImageData image;

  image.LoadFile( "images/Floor.jpg" );

  glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
  glGenTextures( 1, &m_floor );
  glBindTexture( GL_TEXTURE_2D, m_floor );
  glTexImage2D(GL_TEXTURE_2D, 0, 3, image.GetWidth(), image.GetHeight(),
	       0, GL_RGBA, GL_UNSIGNED_BYTE, image.GetImage() );

  glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT );
  glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT );
  glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR );
  glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR );

  static char pname[][30] = {"images/Left.jpg", "images/Front.jpg",
			     "images/Right.jpg", "images/Back.jpg" };
  static char tutorialname[][30] = {"images/EasyTutorial",
				    "images/NormalTutorial",
				    "images/HardTutorial",
				    "" };

  glGenTextures( 4, m_wall );
  for ( i = 0 ; i < 4 ; i++ ) {
    image.LoadFile( &(pname[i][0]) );

    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glBindTexture( GL_TEXTURE_2D, m_wall[i] );
    glTexImage2D(GL_TEXTURE_2D, 0, 3, image.GetWidth(), image.GetHeight(),
		 0, GL_RGBA, GL_UNSIGNED_BYTE, image.GetImage() );

    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT );
    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT );
    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR );
    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR );
  }

  glGenTextures( 4, m_tutorial );

  char filename[256];

  for ( i = 0 ; i < 3 ; i++ ) {
    sprintf( filename, _("%s.ppm"), &(tutorialname[i][0]) );
    image.LoadPPM( filename );
    for ( int j = 0 ; j < image.GetWidth() ; j++ ) {
      for ( int k = 0 ; k < image.GetHeight() ; k++ ) {
	if ( image.GetPixel( j, k, 0 ) >= 5 )
	  image.SetPixel( j, k, 3 , 255 );
	else
	  image.SetPixel( j, k, 3 , 0 );
      }
    }

    glBindTexture( GL_TEXTURE_2D, m_tutorial[i] );
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA,
		 image.GetWidth(), image.GetHeight(),
		 0, GL_RGBA, GL_UNSIGNED_BYTE,
		 image.GetImage() );

    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT );
    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT );
    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR );
    glTexParameteri( GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR );
  }

  m_offset = glGenLists(1);

  glNewList( m_offset, GL_COMPILE );

  if (theRC->gmode == GMODE_SIMPLE) {
    glBegin(GL_LINE_LOOP);			// Draw floor
      glNormal3f( 0.0F, 0.0F, 1.0F );
      glVertex3f( -AREAXSIZE,  AREAYSIZE, 0.0F );
      glVertex3f( -AREAXSIZE, -AREAYSIZE, 0.0F );
      glVertex3f(  AREAXSIZE, -AREAYSIZE, 0.0F );
      glVertex3f(  AREAXSIZE,  AREAYSIZE, 0.0F );
    glEnd();
  } else {
    glBindTexture( GL_TEXTURE_2D, m_floor );

    glBegin(GL_QUADS);				// Draw floor
      glNormal3f( 0.0F, 0.0F, 1.0F );
      glTexCoord2f(0.0F, 0.0F); glVertex3f( -AREAXSIZE*2,  AREAYSIZE*2, 0.0F );
      glTexCoord2f(4.0F, 0.0F); glVertex3f( -AREAXSIZE*2,            0, 0.0F );
      glTexCoord2f(4.0F, 4.0F); glVertex3f(            0,            0, 0.0F );
      glTexCoord2f(0.0F, 4.0F); glVertex3f(            0,  AREAYSIZE*2, 0.0F );

      glTexCoord2f(0.0F, 0.0F); glVertex3f(            0,  AREAYSIZE*2, 0.0F );
      glTexCoord2f(4.0F, 0.0F); glVertex3f(            0,            0, 0.0F );
      glTexCoord2f(4.0F, 4.0F); glVertex3f(  AREAXSIZE*2,            0, 0.0F );
      glTexCoord2f(0.0F, 4.0F); glVertex3f(  AREAXSIZE*2,  AREAYSIZE*2, 0.0F );

      glTexCoord2f(0.0F, 0.0F); glVertex3f( -AREAXSIZE*2,            0, 0.0F );
      glTexCoord2f(4.0F, 0.0F); glVertex3f( -AREAXSIZE*2, -AREAYSIZE*2, 0.0F );
      glTexCoord2f(4.0F, 4.0F); glVertex3f(            0, -AREAYSIZE*2, 0.0F );
      glTexCoord2f(0.0F, 4.0F); glVertex3f(            0,            0, 0.0F );

      glTexCoord2f(0.0F, 0.0F); glVertex3f(            0,            0, 0.0F );
      glTexCoord2f(4.0F, 0.0F); glVertex3f(            0, -AREAYSIZE*2, 0.0F );
      glTexCoord2f(4.0F, 4.0F); glVertex3f(  AREAXSIZE*2, -AREAYSIZE*2, 0.0F );
      glTexCoord2f(0.0F, 4.0F); glVertex3f(  AREAXSIZE*2,            0, 0.0F );
    glEnd();
  }

  glEndList();

  return true;
}

/**
 * Redraw field items.
 * This method is called from BaseView::Redraw.
 * This method draws floor, walls, table leg, etc.
 * @return returns true if succeeds.
 */
bool
FieldView::Redraw() {
  if ( theRC->isTexture )
    glEnable(GL_TEXTURE_2D);

  if ( theRC->gmode != GMODE_SIMPLE ) {
    static GLfloat fld_spc[] = { 1.0F, 1.0F, 1.0F, 0.0F };
    static GLfloat fld_dif[] = { 1.0F, 1.0F, 1.0F, 0.0F };
    static GLfloat fld_amb[] = { 1.0F, 1.0F, 1.0F, 0.0F };
    static GLfloat fld_shininess[] = { 5.0 };
    glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, fld_spc);
    glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, fld_dif);
    glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, fld_amb);
    glMaterialfv(GL_FRONT, GL_SHININESS, fld_shininess);
  }

  glCallList( m_offset );

  if ( theRC->gmode == GMODE_SIMPLE ) {
    glBegin(GL_LINE_LOOP);			// Draw wall
      glNormal3f( 1.0F, 0.0F, 0.0F );
      glVertex3f( -AREAXSIZE,  AREAYSIZE, 0.0F );
      glVertex3f( -AREAXSIZE, -AREAYSIZE, 0.0F );
      glVertex3f( -AREAXSIZE, -AREAYSIZE, AREAZSIZE);
      glVertex3f( -AREAXSIZE,  AREAYSIZE, AREAZSIZE);
    glEnd();

    glBegin(GL_LINE_LOOP);
    glNormal3f( 0.0F, 1.0F, 0.0F );
      glVertex3f( -AREAXSIZE, -AREAYSIZE, 0.0F );
      glVertex3f(  AREAXSIZE, -AREAYSIZE, 0.0F );
      glVertex3f(  AREAXSIZE, -AREAYSIZE, AREAZSIZE);
      glVertex3f( -AREAXSIZE, -AREAYSIZE, AREAZSIZE);
    glEnd();

    glBegin(GL_LINE_LOOP);
      glNormal3f( -1.0F, 0.0F, 0.0F );
      glVertex3f(  AREAXSIZE, -AREAYSIZE, 0.0F );
      glVertex3f(  AREAXSIZE,  AREAYSIZE, 0.0F );
      glVertex3f(  AREAXSIZE,  AREAYSIZE, AREAZSIZE);
      glVertex3f(  AREAXSIZE, -AREAYSIZE, AREAZSIZE);
    glEnd();

    glBegin(GL_LINE_LOOP);
      glNormal3f( 0.0F, -1.0F, 0.0F );
      glVertex3f(  AREAXSIZE, AREAYSIZE, 0.0F );
      glVertex3f( -AREAXSIZE, AREAYSIZE, 0.0F );
      glVertex3f( -AREAXSIZE, AREAYSIZE, AREAZSIZE);
      glVertex3f(  AREAXSIZE, AREAYSIZE, AREAZSIZE);
    glEnd();
  } else {
    glBindTexture( GL_TEXTURE_2D, m_wall[0] );

    glBegin(GL_QUADS);			// Draw wall
      glNormal3f( 1.0F, 0.0F, 0.0F );
      glTexCoord2f(0.0F, 1.0F); glVertex3f( -AREAXSIZE,  AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 1.0F); glVertex3f( -AREAXSIZE, -AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 0.0F); glVertex3f( -AREAXSIZE, -AREAYSIZE, AREAZSIZE);
      glTexCoord2f(0.0F, 0.0F); glVertex3f( -AREAXSIZE,  AREAYSIZE, AREAZSIZE);
    glEnd();

    glBindTexture( GL_TEXTURE_2D, m_wall[1] );
    glBegin(GL_QUADS);
    glNormal3f( 0.0F, 1.0F, 0.0F );
      glTexCoord2f(0.0F, 1.0F); glVertex3f( -AREAXSIZE, -AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 1.0F); glVertex3f(  AREAXSIZE, -AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 0.0F); glVertex3f(  AREAXSIZE, -AREAYSIZE, AREAZSIZE);
      glTexCoord2f(0.0F, 0.0F); glVertex3f( -AREAXSIZE, -AREAYSIZE, AREAZSIZE);
    glEnd();

    glBindTexture( GL_TEXTURE_2D, m_wall[2] );
    glBegin(GL_QUADS);
      glNormal3f( -1.0F, 0.0F, 0.0F );
      glTexCoord2f(0.0F, 1.0F); glVertex3f(  AREAXSIZE, -AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 1.0F); glVertex3f(  AREAXSIZE,  AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 0.0F); glVertex3f(  AREAXSIZE,  AREAYSIZE, AREAZSIZE);
      glTexCoord2f(0.0F, 0.0F); glVertex3f(  AREAXSIZE, -AREAYSIZE, AREAZSIZE);
    glEnd();

    glBindTexture( GL_TEXTURE_2D, m_wall[3] );
    glBegin(GL_QUADS);
      glNormal3f( 0.0F, -1.0F, 0.0F );
      glTexCoord2f(0.0F, 1.0F); glVertex3f(  AREAXSIZE, AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 1.0F); glVertex3f( -AREAXSIZE, AREAYSIZE, 0.0F );
      glTexCoord2f(1.0F, 0.0F); glVertex3f( -AREAXSIZE, AREAYSIZE, AREAZSIZE);
      glTexCoord2f(0.0F, 0.0F); glVertex3f(  AREAXSIZE, AREAYSIZE, AREAZSIZE);
    glEnd();

    if ( theRC->isTexture )
      glDisable(GL_TEXTURE_2D);

    static GLfloat ceil_spc[] = { 1.0F, 1.0F, 1.0F, 0.0F };
    static GLfloat ceil_dif[] = { 0.1F, 0.1F, 0.1F, 0.0F };
    static GLfloat ceil_amb[] = { 0.05F, 0.05F, 0.05F, 0.0F };
    static GLfloat ceil_shininess[] = { 5.0 };
    glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, ceil_spc);
    glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, ceil_dif);
    glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, ceil_amb);
    glMaterialfv(GL_FRONT, GL_SHININESS, ceil_shininess);

    glBegin(GL_QUADS);			// Draw ceiling
      glNormal3f( 0.0F, 0.0F, -1.0F );
      glVertex3f(  AREAXSIZE*2,  AREAYSIZE*2, AREAZSIZE);
      glVertex3f( -AREAXSIZE*2,  AREAYSIZE*2, AREAZSIZE);
      glVertex3f( -AREAXSIZE*2, -AREAYSIZE*2, AREAZSIZE);
      glVertex3f(  AREAXSIZE*2, -AREAYSIZE*2, AREAZSIZE);
    glEnd();

    static GLfloat bs_spc[] = { 0.3F, 0.3F, 0.3F, 0.0F };
    static GLfloat bs_dif[] = { 0.0F, 0.2F, 0.0F, 0.0F };
    static GLfloat bs_amb[] = { 0.0F, 0.1F, 0.0F, 0.0F };
    static GLfloat bs_shininess[] = { 5.0 };
    glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, bs_spc);
    glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, bs_dif);
    glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, bs_amb);
    glMaterialfv(GL_FRONT, GL_SHININESS, bs_shininess);

    glBegin(GL_QUADS);			// Draw ball stopper
      glNormal3f( 1.0F, 0.0F, 0.0F );
      glVertex3f( -AREAXSIZE/2, -AREAYSIZE/2, 0.0F );
      glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
      glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
      glVertex3f( -AREAXSIZE/2, -AREAYSIZE/2, TABLEHEIGHT );

      glNormal3f( -1.0F, 0.0F, 0.0F );
      glVertex3f(  AREAXSIZE/2, -AREAYSIZE/2, 0.0F );
      glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
      glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
      glVertex3f(  AREAXSIZE/2, -AREAYSIZE/2, TABLEHEIGHT );
      /*
      glNormal3f( 0.0F, -1.0F, 0.0F );
      glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
      glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
      glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
      glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
      */
      glNormal3f( 0.0F, 1.0F, 0.0F );
      glVertex3f(  AREAXSIZE/2, -AREAYSIZE/2, 0.0F );
      glVertex3f( -AREAXSIZE/2, -AREAYSIZE/2, 0.0F );
      glVertex3f( -AREAXSIZE/2, -AREAYSIZE/2, TABLEHEIGHT );
      glVertex3f(  AREAXSIZE/2, -AREAYSIZE/2, TABLEHEIGHT );
    glEnd();

    // Show tutorial on ball stopper
    if ( Control::TheControl()->IsPlaying()
	 && theRC->gameLevel <= LEVEL_HARD ) {
      int rotation;

      if ( Event::m_lastTime.time % 5 == 4 ) {
	rotation = (Event::m_lastTime.time%40)/5*32
	  + Event::m_lastTime.millitm/30;
      } else{
	rotation = (Event::m_lastTime.time%40)/5*32;
      }

      if ( theRC->isTexture ) {
	glEnable(GL_TEXTURE_2D);
	glTexEnvf(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_DECAL);
      }

      glBindTexture( GL_TEXTURE_2D, m_tutorial[theRC->gameLevel] );
      glBegin(GL_QUADS);
        glNormal3f( 0.0F, -1.0F, 0.0F );
        glTexCoord2f(0.0F, (rotation+32)/256.0F);
	glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
	glTexCoord2f(1.0F, (rotation+32)/256.0F);
	glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
	glTexCoord2f(1.0F, rotation/256.0F);
	glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
	glTexCoord2f(0.0F, rotation/256.0F);
	glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
      glEnd();

      if ( theRC->isTexture ) {
	glTexEnvf(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_MODULATE);
	glDisable(GL_TEXTURE_2D);
      }

    } else {
      glBegin(GL_QUADS);
        glNormal3f( 0.0F, -1.0F, 0.0F );
	glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
	glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, 0.0F );
	glVertex3f(  AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
	glVertex3f( -AREAXSIZE/2,  AREAYSIZE/2, TABLEHEIGHT );
      glEnd();
    }
  }

  static GLfloat leg_spc[] = { 1.0F, 1.0F, 1.0F, 0.0F };
  static GLfloat leg_dif[] = { 0.0F, 0.6F, 0.0F, 0.0F };
  static GLfloat leg_amb[] = { 0.0F, 0.3F, 0.0F, 0.0F };
  static GLfloat leg_shininess[] = { 5.0 };
  glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, leg_spc);
  glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, leg_dif);
  glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, leg_amb);
  glMaterialfv(GL_FRONT, GL_SHININESS, leg_shininess);

  glBegin(GL_QUADS);			// Draw table legs
    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.1F,  0.0F);
    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.1F,  TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.13F, 0.0F);

    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.13F, 0.0F);
    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F,-TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F,-TABLELENGTH/2+0.13F, 0.0F);

    glVertex3f(-TABLEWIDTH/2+0.13F, -TABLELENGTH/2+0.1F, 0.0F);
    glVertex3f(-TABLEWIDTH/2+0.13F, -TABLELENGTH/2+0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F,-TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F,-TABLELENGTH/2+0.13F, 0.0F);

    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.1F,  0.0F);
    glVertex3f(-TABLEWIDTH/2+0.1F, -TABLELENGTH/2+0.1F,  TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F,-TABLELENGTH/2+0.1F,  TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F,-TABLELENGTH/2+0.1F,  0.0F);


    glVertex3f(-TABLEWIDTH/2+0.1F,  TABLELENGTH/2-0.1F,  0.0F);
    glVertex3f(-TABLEWIDTH/2+0.1F,  TABLELENGTH/2-0.1F,  TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.1F,  TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.1F,  TABLELENGTH/2-0.13F, 0.0F);

    glVertex3f(-TABLEWIDTH/2+0.1F,  TABLELENGTH/2-0.13F, 0.0F);
    glVertex3f(-TABLEWIDTH/2+0.1F,  TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.13F, 0.0F);

    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.1F,  0.0F);
    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.1F,  TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.13F, 0.0F);

    glVertex3f(-TABLEWIDTH/2+0.1F, TABLELENGTH/2-0.1F, 0.0F);
    glVertex3f(-TABLEWIDTH/2+0.1F, TABLELENGTH/2-0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f(-TABLEWIDTH/2+0.13F, TABLELENGTH/2-0.1F, 0.0F);


    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.1F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.13F, 0.0F);

    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.13F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.13F, 0.0F);

    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.1F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.13F, 0.0F);

    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.1F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.1F,-TABLELENGTH/2+0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F,-TABLELENGTH/2+0.1F, 0.0F);


    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.1F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.13F, 0.0F);

    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.13F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.13F, 0.0F);

    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.1F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.13F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.13F, 0.0F);

    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.1F, 0.0F);
    glVertex3f( TABLEWIDTH/2-0.1F, TABLELENGTH/2-0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.1F, TABLEHEIGHT-TABLETHICK);
    glVertex3f( TABLEWIDTH/2-0.13F, TABLELENGTH/2-0.1F, 0.0F);
  glEnd();

  return true;
}

/**
 * Redraw transparent field items.
 * This method is called from BaseView::RedrawAlpha.
 * This method draws table, net, etc.
 * @return returns true if succeeds.
 */
bool
FieldView::RedrawAlpha() {
  static GLfloat tbl_spc[] = { 0.0F, 0.0F, 0.7F, 0.3F };
  static GLfloat tbl_dif[] = { 0.0F, 0.0F, 0.7F, 0.3F };
  static GLfloat tbl_amb[] = { 0.0F, 0.0F, 0.7F, 0.3F };
  static GLfloat tbl_shininess[] = { 5.0 };
  glMaterialfv(GL_FRONT, GL_SPECULAR, tbl_spc);
  glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, tbl_dif);
  glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, tbl_amb);
  glMaterialfv(GL_FRONT, GL_SHININESS, tbl_shininess);

  glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
  glDepthMask(0);
  glBegin(GL_QUADS);			// Draw table
  if ( theRC->gmode != GMODE_SIMPLE ) {
    glNormal3f( 0.0F, 0.0F, -1.0 );
    glVertex3f( -TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f( -TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f(  TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f(  TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );

    glNormal3f( 1.0, 0.0F, 0.0F );
    glVertex3f( TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f( TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );

    glNormal3f( -1.0, 0.0F, 0.0F );
    glVertex3f( -TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f( -TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );

    glNormal3f( 0.0F, 1.0, 0.0F );
    glVertex3f( -TABLEWIDTH/2, TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2, TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f(  TABLEWIDTH/2, TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f(  TABLEWIDTH/2, TABLELENGTH/2, TABLEHEIGHT );

    glNormal3f( 0.0F, -1.0, 0.0F );
    glVertex3f( -TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f(  TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT-TABLETHICK );
    glVertex3f(  TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT );
  }

    glNormal3f( 0.0F, 0.0F, 1.0F );
    glVertex3f( -TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2, -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2,  TABLELENGTH/2, TABLEHEIGHT );
  glEnd();
  glDepthMask(1);

  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

  static GLfloat lin_spc[] = { 1.0F, 1.0F, 1.0F, 1.0F };
  static GLfloat lin_dif[] = { 1.0F, 1.0F, 1.0F, 1.0F };
  static GLfloat lin_amb[] = { 1.0F, 1.0F, 1.0F, 1.0F };
  static GLfloat lin_shininess[] = { 3.0 };
  glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, lin_spc);
  glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, lin_dif);
  glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, lin_amb);
  glMaterialfv(GL_FRONT, GL_SHININESS, lin_shininess);

  glBegin(GL_QUADS);		// Draw white line
    glNormal3f( 0.0F, 0.0F, 1.0F );
    glVertex3f( -TABLEWIDTH/2,       TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2,      -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2+0.02F, -TABLELENGTH/2+0.02F, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2+0.02F,  TABLELENGTH/2-0.02F, TABLEHEIGHT );

    glNormal3f( 0.0F, 0.0F, 1.0F );
    glVertex3f( -TABLEWIDTH/2,      -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2,      -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2-0.02F, -TABLELENGTH/2+0.02F, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2+0.02F, -TABLELENGTH/2+0.02F, TABLEHEIGHT );

    glNormal3f( 0.0F, 0.0F, 1.0F );
    glVertex3f(  TABLEWIDTH/2,      -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2,       TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2-0.02F,  TABLELENGTH/2-0.02F, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2-0.02F, -TABLELENGTH/2+0.02F, TABLEHEIGHT );

    glNormal3f( 0.0F, 0.0F, 1.0F );
    glVertex3f(  TABLEWIDTH/2,       TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2,       TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2+0.02F,  TABLELENGTH/2-0.02F, TABLEHEIGHT );
    glVertex3f(  TABLEWIDTH/2-0.02F,  TABLELENGTH/2-0.02F, TABLEHEIGHT );
  glEnd();

  glBegin(GL_LINES);
    glVertex3f( 0.0F, -TABLELENGTH/2, TABLEHEIGHT );
    glVertex3f( 0.0F,  TABLELENGTH/2, TABLEHEIGHT );
  glEnd();

  static GLfloat net_spc[] = { 0.0F, 0.0F, 0.0F, 0.4F };
  static GLfloat net_dif[] = { 0.0F, 1.0F, 0.0F, 0.4F };
  static GLfloat net_amb[] = { 0.0F, 0.5F, 0.0F, 0.4F };
  glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, net_spc);
  glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, net_dif);
  glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, net_amb);

  glBegin(GL_QUADS);			// Draw net
    glNormal3f( 0.0F, 1.0F, 0.0F );
    glVertex3f( -TABLEWIDTH/2-NETHEIGHT, 0.0F, TABLEHEIGHT );
    glVertex3f( -TABLEWIDTH/2-NETHEIGHT, 0.0F, TABLEHEIGHT+NETHEIGHT-0.01F );
    glVertex3f(  TABLEWIDTH/2+NETHEIGHT, 0.0F, TABLEHEIGHT+NETHEIGHT-0.01F );
    glVertex3f(  TABLEWIDTH/2+NETHEIGHT, 0.0F, TABLEHEIGHT );
  glEnd();

  glMaterialfv(GL_FRONT_AND_BACK, GL_SPECULAR, lin_spc);
  glMaterialfv(GL_FRONT_AND_BACK, GL_DIFFUSE, lin_dif);
  glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, lin_amb);
  glMaterialfv(GL_FRONT, GL_SHININESS, lin_shininess);

  glBegin(GL_QUADS);
    glNormal3f( 0.0F, 1.0F, 0.0F );
    glVertex3f( -TABLEWIDTH/2-NETHEIGHT, 0.0F, TABLEHEIGHT+NETHEIGHT );
    glVertex3f( -TABLEWIDTH/2-NETHEIGHT, 0.0F, TABLEHEIGHT+NETHEIGHT-0.01F );
    glVertex3f(  TABLEWIDTH/2+NETHEIGHT, 0.0F, TABLEHEIGHT+NETHEIGHT-0.01F );
    glVertex3f(  TABLEWIDTH/2+NETHEIGHT, 0.0F, TABLEHEIGHT+NETHEIGHT );
  glEnd();

  return true;
}
