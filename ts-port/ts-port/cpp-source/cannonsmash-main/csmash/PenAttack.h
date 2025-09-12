/**
 * @file
 * @brief Definition of PenAttack class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000, 2004, 2007  神南 吉宏(Kanna Yoshihiro)
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

#ifndef _PenAttack_
#define _PenAttack_
#include "Player.h"

/**
 * PenAttack class is a Player class of pen attack type player.
 */
class PenAttack : public Player {
public:
  PenAttack();
  PenAttack(long side);
  PenAttack( long playerType, long side, const vector3d x, const vector3d v,
	  long status, long swing, long swingType, bool swingSide, long afterSwing,
	  long swingError, const vector2d target, const vector3d eye,
	  const vector3d lookAt,
	  long pow, const vector2d spin, double stamina, long statusMax,
	  long dragX, long dragY );

  virtual ~PenAttack();

private:
  virtual bool SwingType( Ball *ball, long spin );
};

#endif // _PenAttack__
