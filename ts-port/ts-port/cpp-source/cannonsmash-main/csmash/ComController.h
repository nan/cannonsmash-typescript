/**
 * @file
 * @brief Definition of ComController class.
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

#ifndef _ComController_
#define _ComController_

#include "Controller.h"

#define LEVELMARGIN	(0.30/(theRC->gameLevel*theRC->gameLevel*2+1))

/**
 * Com controller class.
 * This class translates the com thought
 * into the behavior of the player.
 */
class ComController : public Controller {
public:
  ComController();
  ComController(Player *parent);
  virtual ~ComController();

  virtual bool Move( SDL_keysym *KeyHistory, long *MouseXHistory,
		     long *MouseYHistory, unsigned long *MouseBHistory,
		     int Histptr );

protected:
  virtual bool Think() = 0;

// Variable for Think()
  int _prevBallstatus;		///< previous ball status
  vector2d _hitX;		///< hit point

  virtual bool Hitarea( vector2d &hitX );
  virtual bool SetTargetX( Player* opponent ) = 0;
  virtual double GetBallTop( vector2d &maxX, Player *p );

  virtual bool isOpponentHit(Ball *ball);

  double SERVEPOSITIONX;	//Default: 0.0;
  double SERVEPOSITIONY;	//Default: -(TABLELENGTH/2+0.2);

  double HOMEPOSITIONX;		//Default: 0.0;
  double HOMEPOSITIONY;		//Default: -(TABLELENGTH/2+0.5);
};

#endif	// _HumanController_
