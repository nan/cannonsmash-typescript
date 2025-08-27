/**
 * @file
 * @brief Definition of HumanController class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2007  神南 吉宏(Kanna Yoshihiro)
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

#ifndef _HumanController_
#define _HumanController_

#include "Controller.h"

/**
 * Human controller class.
 * This class translates the input (Mouse, keyboard)
 * into the behavior of the player.
 */
class HumanController : public Controller {
public:
  HumanController();
  HumanController(Player *parent);
  virtual ~HumanController();

  virtual bool Move( SDL_keysym *KeyHistory, long *MouseXHistory,
		     long *MouseYHistory, unsigned long *MouseBHistory,
		     int Histptr );

  virtual long   GetDragX() { return m_dragX; }		///< Getter method of m_dragX
  virtual long   GetDragY() { return m_dragY; }		///< Getter method of m_dragY

protected:
  bool KeyCheck( SDL_keysym *KeyHistory, long *MouseXHistory,
		 long *MouseYHistory, unsigned long *MouseBHistory,
		 int Histptr );
  long GetKeyCode( SDL_keysym &key );
  void MoveTarget( long code );
  void MoveCamera( long code );

private:
  long m_dragX;		///< Mouse drag
  long m_dragY;		///< Mouse drag
};

#endif	// _HumanController_
