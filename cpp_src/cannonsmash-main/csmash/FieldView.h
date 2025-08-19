/**
 * @file
 * @brief Definition of FieldView class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000, 2002  神南 吉宏(Kanna Yoshihiro)
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

#ifndef _FieldView_
#define _FieldView_

#include "View.h"
#include <GL/gl.h>

/**
 * View class which draws field.
 * This class draws field (floor, wall, table, etc.) when
 * Redraw() and RedrawAlpha() are called.
 */
class FieldView : public View {
public:
  FieldView();
  virtual bool Init();
  virtual ~FieldView();

  virtual bool Redraw();
  virtual bool RedrawAlpha();

  GLuint       m_offset;	///< glList ID to draw basic field.
  GLuint       m_floor;		///< floor texture ID.
  //GLuint       m_title;
  GLuint       m_wall[4];	///< wall texture ID.
  GLuint       m_tutorial[4];	///< tutorial texture ID.
};

#endif	// _FieldView
