/**
 * @file
 * @brief Definition of ComPenAttackController class.
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

#ifndef _ComPenAttackController_
#define _ComPenAttackController_

#include "ComController.h"

/**
 * ComPenAttackController class is a Controller class of pen attack
 *  type player who is controlled by Com.
 */
class ComPenAttackController : public ComController {
public:
  ComPenAttackController();
  ComPenAttackController(Player *parent);

  virtual ~ComPenAttackController();

protected:
  virtual bool Think();
  virtual bool SetTargetX( Player* opponent );
};

#endif // _ComPenAttackController_
