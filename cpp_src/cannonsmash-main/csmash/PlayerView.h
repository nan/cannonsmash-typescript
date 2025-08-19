/**
 * @file
 * @brief Definition of PlayerView class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000-2004, 2007  Kanna Yoshihiro
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

#ifndef _PlayerView_
#define _PlayerView_
#include "View.h"

#include <algorithm>
#include <vector>
#include "float"
#include "matrix"
#include "affine"

#if !defined(CHIYO)
class partsmotion;
typedef partsmotion partsmotion_t;
#else
class body_parts;
typedef body_parts partsmotion_t;
#endif

class Player;

/**
 * PlayerView class is a view class of player.
 */
class PlayerView : public View {
public:
  PlayerView();
  virtual ~PlayerView();

  static void * LoadData(void *dum);

  virtual bool Init( Player *player );

  virtual bool Redraw();
  virtual bool RedrawAlpha();

  void DrawTargetCircle( double diff );
private:
  Player  *m_player;		///< Reference to attached Player object.

  partsmotion_t *m_Fnormal;		///< Motion handler of Fnormal motion.
  partsmotion_t *m_Bnormal;		///< Motion handler of Bnormal motion.
  partsmotion_t *m_Fdrive;		///< Motion handler of Fdrive motion.
  partsmotion_t *m_Bdrive;		///< Motion handler of Bdrive motion.
  partsmotion_t *m_Fcut;		///< Motion handler of Fcut motion.
  partsmotion_t *m_Bcut;		///< Motion handler of Bcut motion.
  partsmotion_t *m_Fpeck;		///< Motion handler of Fpeck motion.
  partsmotion_t *m_Bpeck;		///< Motion handler of Bpeck motion.
  partsmotion_t *m_Fsmash;		///< Motion handler of Fsmash motion.
  partsmotion_t *m_Bsmash;		///< Motion handler of Bsmash motion.

  partsmotion_t *m_FSpeck;		///< Motion handler of FSpeck motion.
  partsmotion_t *m_FSside1;		///< Motion handler of FSside1 motion.
  partsmotion_t *m_FSside2;		///< Motion handler of FSside2 motion.

  static partsmotion_t *motion_Fnormal;	///< Motion handler of Fnormal motion.
  static partsmotion_t *motion_Bnormal;	///< Motion handler of Bnormal motion.
  static partsmotion_t *motion_Fdrive;	///< Motion handler of Fdrive motion.
  static partsmotion_t *motion_Fcut;	///< Motion handler of Fcut motion.
  static partsmotion_t *motion_Bcut;	///< Motion handler of Bcut motion.
  static partsmotion_t *motion_Fpeck;	///< Motion handler of Fpeck motion.
  static partsmotion_t *motion_Bpeck;	///< Motion handler of Bpeck motion.
  static partsmotion_t *motion_Fsmash;	///< Motion handler of Fsmash motion.

  static partsmotion_t *motion_FSpeck;	///< Motion handler of FSpeck motion.
  static partsmotion_t *motion_FSside1;	///< Motion handler of FSside1 motion.
  static partsmotion_t *motion_FSside2;	///< Motion handler of FSside2 motion.

  virtual bool SubRedraw();
  double GetHitpointY();

  void DrawPlayer();
  void DrawTarget();

  vector3F m_diff;			///< diff of upper body
};

#endif	// _PlayerView
